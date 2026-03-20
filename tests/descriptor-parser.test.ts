// tests/descriptor-parser.test.ts
// Unit tests for DescriptorParser - the extracted proto parsing core

import { describe, it, expect, beforeEach } from 'vitest';
import { DescriptorParser } from '@/lib/grpc/descriptor-parser';
import {
	GREETER_FD_BYTES,
	COMPLEX_FD_BYTES,
	MULTI_SERVICE_FD_BYTES,
	GREETER_FDS_BYTES,
	COMPLEX_FDS_BYTES,
	MULTI_FDS_BYTES,
	encodeFileDescriptor,
	encodeFileDescriptorSet,
	EMPTY_FILE_DESCRIPTOR,
} from './fixtures';

describe('DescriptorParser', () => {
	let parser: DescriptorParser;

	beforeEach(() => {
		parser = new DescriptorParser();
	});

	// -- processFileDescriptor (single descriptor from reflection) --

	describe('processFileDescriptor', () => {
		it('parses a simple service with one method', () => {
			parser.processFileDescriptor(GREETER_FD_BYTES);
			const services = parser.getServices();

			expect(services).toHaveLength(1);
			expect(services[0].name).toBe('GreeterService');
			expect(services[0].fullName).toBe('example.greeter.GreeterService');
			expect(services[0].methods).toHaveLength(1);

			const method = services[0].methods[0];
			expect(method.name).toBe('SayHello');
			expect(method.requestType).toBe('example.greeter.HelloRequest');
			expect(method.responseType).toBe('example.greeter.HelloReply');
			expect(method.requestStreaming).toBe(false);
			expect(method.responseStreaming).toBe(false);
		});

		it('extracts request type definitions with correct fields', () => {
			parser.processFileDescriptor(GREETER_FD_BYTES);
			const services = parser.getServices();
			const method = services[0].methods[0];

			expect(method.requestTypeDefinition).toBeDefined();
			expect(method.requestTypeDefinition.name).toBe('HelloRequest');
			expect(method.requestTypeDefinition.fullName).toBe('example.greeter.HelloRequest');
			expect(method.requestTypeDefinition.fields).toHaveLength(2);

			const nameField = method.requestTypeDefinition.fields.find(f => f.name === 'name');
			expect(nameField).toBeDefined();
			expect(nameField!.type).toBe('string');

			const ageField = method.requestTypeDefinition.fields.find(f => f.name === 'age');
			expect(ageField).toBeDefined();
			expect(ageField!.type).toBe('int32');
		});

		it('extracts response type definitions', () => {
			parser.processFileDescriptor(GREETER_FD_BYTES);
			const services = parser.getServices();
			const method = services[0].methods[0];

			expect(method.responseTypeDefinition).toBeDefined();
			expect(method.responseTypeDefinition.name).toBe('HelloReply');
			expect(method.responseTypeDefinition.fields).toHaveLength(1);
			expect(method.responseTypeDefinition.fields[0].name).toBe('message');
			expect(method.responseTypeDefinition.fields[0].type).toBe('string');
		});

		it('handles enums correctly', () => {
			parser.processFileDescriptor(COMPLEX_FD_BYTES);
			const services = parser.getServices();
			const method = services[0].methods[0]; // GetUser

			const statusField = method.requestTypeDefinition.fields.find(f => f.name === 'status');
			expect(statusField).toBeDefined();
			expect(statusField!.enumValues).toBeDefined();
			expect(statusField!.enumValues).toContain('UNKNOWN');
			expect(statusField!.enumValues).toContain('ACTIVE');
			expect(statusField!.enumValues).toContain('INACTIVE');
			expect(statusField!.nested).toBe(false); // enum, not nested message
		});

		it('handles nested messages', () => {
			parser.processFileDescriptor(COMPLEX_FD_BYTES);
			const services = parser.getServices();
			const method = services[0].methods[0];

			const addressField = method.requestTypeDefinition.fields.find(f => f.name === 'address');
			expect(addressField).toBeDefined();
			expect(addressField!.nested).toBe(true);
			expect(addressField!.nestedFields).toBeDefined();
			expect(addressField!.nestedFields!.length).toBe(3);

			const streetField = addressField!.nestedFields!.find(f => f.name === 'street');
			expect(streetField).toBeDefined();
			expect(streetField!.type).toBe('string');
		});

		it('handles repeated fields', () => {
			parser.processFileDescriptor(COMPLEX_FD_BYTES);
			const services = parser.getServices();
			const method = services[0].methods[0];

			const tagsField = method.requestTypeDefinition.fields.find(f => f.name === 'tags');
			expect(tagsField).toBeDefined();
			expect(tagsField!.rule).toBe('repeated');
			expect(tagsField!.type).toBe('string');
		});

		it('detects server streaming methods', () => {
			parser.processFileDescriptor(COMPLEX_FD_BYTES);
			const services = parser.getServices();
			const listMethod = services[0].methods.find(m => m.name === 'ListUsers');

			expect(listMethod).toBeDefined();
			expect(listMethod!.requestStreaming).toBe(false);
			expect(listMethod!.responseStreaming).toBe(true);
		});

		it('handles multiple services in one descriptor', () => {
			parser.processFileDescriptor(MULTI_SERVICE_FD_BYTES);
			const services = parser.getServices();

			expect(services).toHaveLength(2);
			const names = services.map(s => s.name).sort();
			expect(names).toEqual(['HealthService', 'PingService']);
		});

		it('deduplicates files by name', () => {
			parser.processFileDescriptor(GREETER_FD_BYTES);
			parser.processFileDescriptor(GREETER_FD_BYTES); // same file again

			const services = parser.getServices();
			expect(services).toHaveLength(1); // not duplicated
		});

		it('accumulates services from multiple files', () => {
			parser.processFileDescriptor(GREETER_FD_BYTES);
			parser.processFileDescriptor(COMPLEX_FD_BYTES);

			const services = parser.getServices();
			expect(services).toHaveLength(2);
			const names = services.map(s => s.name).sort();
			expect(names).toEqual(['GreeterService', 'UserService']);
		});

		it('handles empty file descriptor gracefully', () => {
			const emptyBytes = encodeFileDescriptor(EMPTY_FILE_DESCRIPTOR);
			parser.processFileDescriptor(emptyBytes);
			const services = parser.getServices();
			expect(services).toHaveLength(0);
		});

		it('handles messages with no fields (empty request)', () => {
			parser.processFileDescriptor(COMPLEX_FD_BYTES);
			const services = parser.getServices();
			const listMethod = services[0].methods.find(m => m.name === 'ListUsers');

			expect(listMethod).toBeDefined();
			expect(listMethod!.requestTypeDefinition.fields).toHaveLength(0);
		});
	});

	// -- loadFileDescriptorSet (binary FDS from BSR) --

	describe('loadFileDescriptorSet', () => {
		it('parses a FileDescriptorSet with a single file', () => {
			parser.loadFileDescriptorSet(GREETER_FDS_BYTES);
			const services = parser.getServices();

			expect(services).toHaveLength(1);
			expect(services[0].name).toBe('GreeterService');
		});

		it('parses a FileDescriptorSet with multiple files', () => {
			parser.loadFileDescriptorSet(MULTI_FDS_BYTES);
			const services = parser.getServices();

			// 3 files: greeter (1 svc), complex (1 svc), multi (2 svc) = 4 services
			expect(services).toHaveLength(4);
		});

		it('deduplicates files within a set', () => {
			// Build an FDS with the same file twice
			const doubleFds = encodeFileDescriptorSet([
				{ name: 'greeter.proto', package: 'example.greeter', messageType: [{ name: 'HelloRequest', field: [{ name: 'name', number: 1, type: 9, label: 1 }] }], service: [{ name: 'GreeterService', method: [{ name: 'SayHello', inputType: '.example.greeter.HelloRequest', outputType: '.example.greeter.HelloRequest', clientStreaming: false, serverStreaming: false }] }] },
				{ name: 'greeter.proto', package: 'example.greeter', messageType: [{ name: 'HelloRequest', field: [{ name: 'name', number: 1, type: 9, label: 1 }] }], service: [{ name: 'GreeterService', method: [{ name: 'SayHello', inputType: '.example.greeter.HelloRequest', outputType: '.example.greeter.HelloRequest', clientStreaming: false, serverStreaming: false }] }] },
			]);

			parser.loadFileDescriptorSet(doubleFds);
			const services = parser.getServices();
			expect(services).toHaveLength(1);
		});

		it('throws on empty FileDescriptorSet', () => {
			const emptyFds = encodeFileDescriptorSet([]);
			expect(() => parser.loadFileDescriptorSet(emptyFds)).toThrow('contains no file descriptors');
		});

		it('preserves full type definitions across files', () => {
			parser.loadFileDescriptorSet(COMPLEX_FDS_BYTES);
			const services = parser.getServices();
			const method = services[0].methods[0];

			// UserRequest.address should resolve to Address nested fields
			const addressField = method.requestTypeDefinition.fields.find(f => f.name === 'address');
			expect(addressField!.nestedFields).toBeDefined();
			expect(addressField!.nestedFields!.length).toBe(3);
		});
	});

	// -- getRoot --

	describe('getRoot', () => {
		it('returns a protobuf Root', () => {
			const root = parser.getRoot();
			expect(root).toBeDefined();
			expect(root).toBeInstanceOf(Object);
		});

		it('root accumulates types from parsed descriptors', () => {
			parser.processFileDescriptor(GREETER_FD_BYTES);
			const root = parser.getRoot();

			const helloReq = root.lookupType('example.greeter.HelloRequest');
			expect(helloReq).toBeDefined();
			expect(helloReq.name).toBe('HelloRequest');
		});
	});

	// -- extractMessageTypeDefinition --

	describe('extractMessageTypeDefinition', () => {
		it('returns empty fields for unknown types', () => {
			const def = parser.extractMessageTypeDefinition('nonexistent.Type');
			expect(def.fields).toHaveLength(0);
			expect(def.name).toBe('Type');
			expect(def.fullName).toBe('nonexistent.Type');
		});

		it('handles all primitive field types', () => {
			// Create a message with various primitive types
			const protoWithPrimitives = encodeFileDescriptor({
				name: 'primitives.proto',
				package: 'test',
				messageType: [{
					name: 'AllPrimitives',
					field: [
						{ name: 'f_double', number: 1, type: 1, label: 1 },
						{ name: 'f_float', number: 2, type: 2, label: 1 },
						{ name: 'f_int64', number: 3, type: 3, label: 1 },
						{ name: 'f_uint64', number: 4, type: 4, label: 1 },
						{ name: 'f_int32', number: 5, type: 5, label: 1 },
						{ name: 'f_bool', number: 6, type: 8, label: 1 },
						{ name: 'f_string', number: 7, type: 9, label: 1 },
						{ name: 'f_bytes', number: 8, type: 12, label: 1 },
						{ name: 'f_uint32', number: 9, type: 13, label: 1 },
					],
				}],
			});

			parser.processFileDescriptor(protoWithPrimitives);
			const def = parser.extractMessageTypeDefinition('test.AllPrimitives');

			expect(def.fields).toHaveLength(9);

			const types = new Map(def.fields.map(f => [f.name, f.type]));
			expect(types.get('f_double')).toBe('double');
			expect(types.get('f_float')).toBe('float');
			expect(types.get('f_int64')).toBe('int64');
			expect(types.get('f_uint64')).toBe('uint64');
			expect(types.get('f_int32')).toBe('int32');
			expect(types.get('f_bool')).toBe('bool');
			expect(types.get('f_string')).toBe('string');
			expect(types.get('f_bytes')).toBe('bytes');
			expect(types.get('f_uint32')).toBe('uint32');

			// All primitives should not be marked as nested
			for (const field of def.fields) {
				expect(field.nested).toBeFalsy();
			}
		});
	});

	// -- hasFile --

	describe('hasFile', () => {
		it('returns false before parsing', () => {
			expect(parser.hasFile('greeter.proto')).toBe(false);
		});

		it('returns true after parsing', () => {
			parser.processFileDescriptor(GREETER_FD_BYTES);
			expect(parser.hasFile('greeter.proto')).toBe(true);
		});

		it('returns false for unparsed files', () => {
			parser.processFileDescriptor(GREETER_FD_BYTES);
			expect(parser.hasFile('complex.proto')).toBe(false);
		});
	});
});
