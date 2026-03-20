// tests/fixtures.ts
// Mock protobuf fixtures for testing, inspired by yaci's mock_file_descriptor.go pattern.
// Builds minimal FileDescriptorProto/FileDescriptorSet binary data that DescriptorParser can consume.

import * as protobuf from 'protobufjs';
import descriptorJson from 'protobufjs/google/protobuf/descriptor.json';

const descriptorRoot = protobuf.Root.fromJSON(descriptorJson);
const FileDescriptorProto = descriptorRoot.lookupType('google.protobuf.FileDescriptorProto');
const FileDescriptorSet = descriptorRoot.lookupType('google.protobuf.FileDescriptorSet');

/**
 * Encode a FileDescriptorProto message object into binary.
 * Mirrors yaci's MockFileDescriptor pattern.
 */
export function encodeFileDescriptor(fd: Record<string, any>): Buffer {
	const msg = FileDescriptorProto.fromObject(fd);
	return Buffer.from(FileDescriptorProto.encode(msg).finish());
}

/**
 * Encode a FileDescriptorSet (array of FileDescriptorProto) into binary.
 * This is what BSR returns as application/x-protobuf.
 */
export function encodeFileDescriptorSet(files: Record<string, any>[]): Buffer {
	const msg = FileDescriptorSet.fromObject({ file: files });
	return Buffer.from(FileDescriptorSet.encode(msg).finish());
}

// -- Minimal service with one unary method --

/** A simple greeter.proto equivalent */
export const GREETER_FILE_DESCRIPTOR = {
	name: 'greeter.proto',
	package: 'example.greeter',
	messageType: [
		{
			name: 'HelloRequest',
			field: [
				{ name: 'name', number: 1, type: 9 /* TYPE_STRING */, label: 1 },
				{ name: 'age', number: 2, type: 5 /* TYPE_INT32 */, label: 1 },
			],
		},
		{
			name: 'HelloReply',
			field: [
				{ name: 'message', number: 1, type: 9 /* TYPE_STRING */, label: 1 },
			],
		},
	],
	service: [
		{
			name: 'GreeterService',
			method: [
				{
					name: 'SayHello',
					inputType: '.example.greeter.HelloRequest',
					outputType: '.example.greeter.HelloReply',
					clientStreaming: false,
					serverStreaming: false,
				},
			],
		},
	],
};

// -- Service with enum, nested message, repeated field --

export const COMPLEX_FILE_DESCRIPTOR = {
	name: 'complex.proto',
	package: 'example.complex',
	enumType: [
		{
			name: 'Status',
			value: [
				{ name: 'UNKNOWN', number: 0 },
				{ name: 'ACTIVE', number: 1 },
				{ name: 'INACTIVE', number: 2 },
			],
		},
	],
	messageType: [
		{
			name: 'Address',
			field: [
				{ name: 'street', number: 1, type: 9, label: 1 },
				{ name: 'city', number: 2, type: 9, label: 1 },
				{ name: 'zip', number: 3, type: 9, label: 1 },
			],
		},
		{
			name: 'UserRequest',
			field: [
				{ name: 'id', number: 1, type: 9 /* STRING */, label: 1 },
				{ name: 'status', number: 2, type: 14 /* TYPE_ENUM */, label: 1, typeName: '.example.complex.Status' },
				{ name: 'address', number: 3, type: 11 /* TYPE_MESSAGE */, label: 1, typeName: '.example.complex.Address' },
				{ name: 'tags', number: 4, type: 9, label: 3 /* LABEL_REPEATED */ },
			],
		},
		{
			name: 'UserResponse',
			field: [
				{ name: 'user', number: 1, type: 11, label: 1, typeName: '.example.complex.UserRequest' },
				{ name: 'found', number: 2, type: 8 /* TYPE_BOOL */, label: 1 },
			],
		},
		{
			name: 'Empty',
			field: [],
		},
	],
	service: [
		{
			name: 'UserService',
			method: [
				{
					name: 'GetUser',
					inputType: '.example.complex.UserRequest',
					outputType: '.example.complex.UserResponse',
					clientStreaming: false,
					serverStreaming: false,
				},
				{
					name: 'ListUsers',
					inputType: '.example.complex.Empty',
					outputType: '.example.complex.UserResponse',
					clientStreaming: false,
					serverStreaming: true,
				},
			],
		},
	],
};

// -- Multiple services in one file --

export const MULTI_SERVICE_FILE_DESCRIPTOR = {
	name: 'multi.proto',
	package: 'example.multi',
	messageType: [
		{
			name: 'PingRequest',
			field: [
				{ name: 'payload', number: 1, type: 12 /* TYPE_BYTES */, label: 1 },
			],
		},
		{
			name: 'PingResponse',
			field: [
				{ name: 'payload', number: 1, type: 12, label: 1 },
			],
		},
		{
			name: 'HealthRequest',
			field: [],
		},
		{
			name: 'HealthResponse',
			field: [
				{ name: 'healthy', number: 1, type: 8 /* TYPE_BOOL */, label: 1 },
				{ name: 'uptime', number: 2, type: 3 /* TYPE_INT64 */, label: 1 },
			],
		},
	],
	service: [
		{
			name: 'PingService',
			method: [
				{
					name: 'Ping',
					inputType: '.example.multi.PingRequest',
					outputType: '.example.multi.PingResponse',
					clientStreaming: false,
					serverStreaming: false,
				},
			],
		},
		{
			name: 'HealthService',
			method: [
				{
					name: 'Check',
					inputType: '.example.multi.HealthRequest',
					outputType: '.example.multi.HealthResponse',
					clientStreaming: false,
					serverStreaming: false,
				},
			],
		},
	],
};

// -- Empty file (no services/messages) --

export const EMPTY_FILE_DESCRIPTOR = {
	name: 'empty.proto',
	package: 'example.empty',
};

// -- Pre-encoded binaries for convenience --

export const GREETER_FD_BYTES = encodeFileDescriptor(GREETER_FILE_DESCRIPTOR);
export const COMPLEX_FD_BYTES = encodeFileDescriptor(COMPLEX_FILE_DESCRIPTOR);
export const MULTI_SERVICE_FD_BYTES = encodeFileDescriptor(MULTI_SERVICE_FILE_DESCRIPTOR);

export const GREETER_FDS_BYTES = encodeFileDescriptorSet([GREETER_FILE_DESCRIPTOR]);
export const COMPLEX_FDS_BYTES = encodeFileDescriptorSet([COMPLEX_FILE_DESCRIPTOR]);
export const MULTI_FDS_BYTES = encodeFileDescriptorSet([
	GREETER_FILE_DESCRIPTOR,
	COMPLEX_FILE_DESCRIPTOR,
	MULTI_SERVICE_FILE_DESCRIPTOR,
]);
