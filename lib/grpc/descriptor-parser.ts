// lib/grpc/descriptor-parser.ts
// Extracted FileDescriptorSet parsing logic, shared by ReflectionClient and BSR routes

import * as protobuf from 'protobufjs';
import descriptorJson from 'protobufjs/google/protobuf/descriptor.json';

export interface MessageField {
	name: string;
	type: string;
	rule?: 'optional' | 'required' | 'repeated';
	defaultValue?: any;
	comment?: string;
	nested?: boolean;
	enumValues?: string[];
	nestedFields?: MessageField[];
}

export interface MessageTypeDefinition {
	name: string;
	fullName: string;
	fields: MessageField[];
}

export interface HttpRule {
	get?: string;
	post?: string;
	put?: string;
	delete?: string;
	patch?: string;
	body?: string;
	additionalBindings?: HttpRule[];
}

export interface GrpcMethod {
	name: string;
	fullName: string;
	serviceName: string;
	requestType: string;
	responseType: string;
	requestStreaming: boolean;
	responseStreaming: boolean;
	description?: string;
	httpRule?: HttpRule;
	requestTypeDefinition: MessageTypeDefinition;
	responseTypeDefinition: MessageTypeDefinition;
}

export interface GrpcService {
	name: string;
	fullName: string;
	methods: GrpcMethod[];
}

/**
 * Parses protobuf FileDescriptorSet data into a protobufjs Root,
 * then extracts GrpcService/GrpcMethod definitions.
 *
 * Used by ReflectionClient (per-descriptor) and BSR route (full FileDescriptorSet).
 */
export class DescriptorParser {
	private root: protobuf.Root;
	private descriptorRoot: protobuf.Root;
	private seenFiles = new Set<string>();
	private methodOptions: Map<string, any> = new Map();

	constructor() {
		this.root = new protobuf.Root();
		this.descriptorRoot = protobuf.Root.fromJSON(descriptorJson);
	}

	/** Parse a binary FileDescriptorSet (e.g. from BSR) and load all file descriptors */
	loadFileDescriptorSet(data: Buffer): void {
		const FileDescriptorSet = this.descriptorRoot.lookupType('google.protobuf.FileDescriptorSet');
		const fds = FileDescriptorSet.decode(new Uint8Array(data)) as any;

		if (!fds.file || fds.file.length === 0) {
			throw new Error('FileDescriptorSet contains no file descriptors');
		}

		for (const fileDescriptor of fds.file) {
			const filename = fileDescriptor.name || 'unknown';
			if (this.seenFiles.has(filename)) continue;
			this.seenFiles.add(filename);
			this.addDescriptorToRoot(fileDescriptor);
		}
	}

	/** Process a single raw FileDescriptorProto (binary bytes from reflection) */
	processFileDescriptor(fdBytes: Buffer): void {
		const FileDescriptorProto = this.descriptorRoot.lookupType('google.protobuf.FileDescriptorProto');
		const descriptor = FileDescriptorProto.decode(fdBytes) as any;
		const filename = descriptor.name || 'unknown';

		if (this.seenFiles.has(filename)) return;
		this.seenFiles.add(filename);
		this.addDescriptorToRoot(descriptor);
	}

	/** Get all discovered services with full method + type definitions */
	getServices(): GrpcService[] {
		const services: GrpcService[] = [];

		const traverse = (namespace: protobuf.Namespace, parentPath: string = ''): void => {
			for (const [name, nested] of Object.entries(namespace.nested || {})) {
				const fullPath = parentPath ? `${parentPath}.${name}` : name;

				if (nested instanceof protobuf.Service) {
					const methods: GrpcMethod[] = [];

					for (const [methodName, method] of Object.entries(nested.methods)) {
						const m = method as protobuf.Method;
						if (!methodName || !m.requestType || !m.responseType) {
							console.warn(`[DescriptorParser] Skipping invalid method in ${fullPath}: missing name or types`);
							continue;
						}

						try {
							const requestTypeDefinition = this.extractMessageTypeDefinition(m.requestType);
							const responseTypeDefinition = this.extractMessageTypeDefinition(m.responseType);
							const methodKey = `${fullPath}.${methodName}`;
							const httpRule = this.extractHttpRule(methodKey);

							const methodObj: GrpcMethod = {
								name: methodName,
								fullName: `${fullPath}.${methodName}`,
								serviceName: fullPath,
								requestType: m.requestType,
								responseType: m.responseType,
								requestStreaming: m.requestStream || false,
								responseStreaming: m.responseStream || false,
								requestTypeDefinition,
								responseTypeDefinition,
							};

							if (httpRule) {
								methodObj.httpRule = httpRule;
							}

							methods.push(methodObj);
						} catch (err) {
							console.warn(`[DescriptorParser] Failed to process method ${methodName} in ${fullPath}:`, err);
						}
					}

					if (methods.length > 0) {
						services.push({ name, fullName: fullPath, methods });
					}
				} else if (nested instanceof protobuf.Namespace) {
					traverse(nested, fullPath);
				}
			}
		};

		traverse(this.root);
		return services;
	}

	/** Get the underlying protobufjs Root */
	getRoot(): protobuf.Root {
		return this.root;
	}

	/** Get the descriptor Root (for FileDescriptorProto lookups) */
	getDescriptorRoot(): protobuf.Root {
		return this.descriptorRoot;
	}

	/** Check if a file has already been processed */
	hasFile(filename: string): boolean {
		return this.seenFiles.has(filename);
	}

	// -- Internal methods --

	private addDescriptorToRoot(descriptor: any): void {
		const pkg = descriptor.package || '';

		let namespace: protobuf.Namespace = this.root;
		if (pkg) {
			const parts = pkg.split('.');
			for (const part of parts) {
				let next = namespace.get(part);
				if (!next) {
					next = new protobuf.Namespace(part);
					namespace.add(next);
				}
				namespace = next as protobuf.Namespace;
			}
		}

		if (descriptor.enumType) {
			for (const enumType of descriptor.enumType) {
				try {
					this.addEnumType(namespace, enumType);
				} catch (err) {
					if (!(err as Error).message.includes('duplicate')) {
						console.warn(`Failed to add enum ${enumType.name}:`, err);
					}
				}
			}
		}

		if (descriptor.messageType) {
			for (const msgType of descriptor.messageType) {
				try {
					this.addMessageType(namespace, msgType);
				} catch (err) {
					if (!(err as Error).message.includes('duplicate')) {
						console.warn(`Failed to add message ${msgType.name}:`, err);
					}
				}
			}
		}

		if (descriptor.service) {
			for (const svcType of descriptor.service) {
				try {
					this.addServiceType(namespace, svcType, pkg);
				} catch (err) {
					if (!(err as Error).message.includes('duplicate')) {
						console.warn(`Failed to add service ${svcType.name}:`, err);
					}
				}
			}
		}
	}

	private addMessageType(namespace: protobuf.Namespace, msgType: any): void {
		const fields: any = {};

		if (msgType.field) {
			for (const field of msgType.field) {
				fields[field.name] = {
					type: this.getFieldType(field),
					id: field.number,
					rule: field.label === 3 ? 'repeated' : undefined,
				};
			}
		}

		const message = new protobuf.Type(msgType.name);
		for (const [name, fieldDef] of Object.entries(fields)) {
			message.add(new protobuf.Field(name, (fieldDef as any).id, (fieldDef as any).type, (fieldDef as any).rule));
		}

		namespace.add(message);

		if (msgType.enumType) {
			for (const nested of msgType.enumType) {
				this.addEnumType(message, nested);
			}
		}

		if (msgType.nestedType) {
			for (const nested of msgType.nestedType) {
				this.addMessageType(message, nested);
			}
		}
	}

	private addEnumType(namespace: protobuf.Namespace, enumType: any): void {
		const values: { [key: string]: number } = {};

		if (enumType.value) {
			for (const value of enumType.value) {
				values[value.name] = value.number;
			}
		}

		const enumObj = new protobuf.Enum(enumType.name, values);
		namespace.add(enumObj);
	}

	private addServiceType(namespace: protobuf.Namespace, svcType: any, packagePath: string): void {
		const service = new protobuf.Service(svcType.name);
		const serviceFullName = packagePath ? `${packagePath}.${svcType.name}` : svcType.name;

		if (svcType.method) {
			for (const method of svcType.method) {
				const protoMethod = new protobuf.Method(
					method.name,
					'rpc',
					method.inputType.replace(/^\./, ''),
					method.outputType.replace(/^\./, ''),
					method.clientStreaming || false,
					method.serverStreaming || false
				);
				service.add(protoMethod);

				if (method.options) {
					const methodKey = `${serviceFullName}.${method.name}`;
					this.methodOptions.set(methodKey, method.options);
				}
			}
		}

		namespace.add(service);
	}

	private extractHttpRule(methodKey: string): HttpRule | undefined {
		const options = this.methodOptions.get(methodKey);
		if (!options) return undefined;

		const httpAnnotation = options['.google.api.http'] ||
			options['google.api.http'] ||
			options['(google.api.http)'] ||
			options[72295728];

		if (!httpAnnotation) return undefined;

		const rule: HttpRule = {};

		if (httpAnnotation.get) rule.get = httpAnnotation.get;
		if (httpAnnotation.post) rule.post = httpAnnotation.post;
		if (httpAnnotation.put) rule.put = httpAnnotation.put;
		if (httpAnnotation.delete) rule.delete = httpAnnotation.delete;
		if (httpAnnotation.patch) rule.patch = httpAnnotation.patch;
		if (httpAnnotation.body) rule.body = httpAnnotation.body;

		if (httpAnnotation.additionalBindings && Array.isArray(httpAnnotation.additionalBindings)) {
			rule.additionalBindings = httpAnnotation.additionalBindings.map((binding: any) => ({
				get: binding.get,
				post: binding.post,
				put: binding.put,
				delete: binding.delete,
				patch: binding.patch,
				body: binding.body,
			}));
		}

		if (!rule.get && !rule.post && !rule.put && !rule.delete && !rule.patch) {
			return undefined;
		}

		return rule;
	}

	getFieldType(field: any): string {
		const typeMap: Record<number, string> = {
			1: 'double', 2: 'float', 3: 'int64', 4: 'uint64',
			5: 'int32', 6: 'fixed64', 7: 'fixed32', 8: 'bool',
			9: 'string', 12: 'bytes', 13: 'uint32', 15: 'sfixed32',
			16: 'sfixed64', 17: 'sint32', 18: 'sint64',
		};

		if (field.type in typeMap) {
			return typeMap[field.type];
		}

		if (field.typeName) {
			return field.typeName.replace(/^\./, '');
		}

		return 'string';
	}

	extractMessageTypeDefinition(typeName: string, visitedTypes: Set<string> = new Set()): MessageTypeDefinition {
		try {
			const message = this.root.lookupType(typeName);
			if (!message) {
				return {
					name: typeName.split('.').pop() || typeName,
					fullName: typeName,
					fields: [],
				};
			}

			const fields: MessageField[] = [];

			if (message.fields && Object.keys(message.fields).length > 0) {
				for (const [fieldName, field] of Object.entries(message.fields)) {
					const fieldObj = field as any;
					const fieldType = fieldObj.type;
					const rule = fieldObj.rule;
					const comment = fieldObj.comment || '';

					const primitiveTypes = [
						'string', 'int32', 'int64', 'uint32', 'uint64',
						'sint32', 'sint64', 'fixed32', 'fixed64', 'sfixed32',
						'sfixed64', 'bool', 'bytes', 'double', 'float'
					];
					const isNested = fieldType && typeof fieldType === 'string' && !primitiveTypes.includes(fieldType);

					let enumValues: string[] | undefined;
					let nestedFields: MessageField[] | undefined;

					if (isNested) {
						try {
							const nestedType = this.root.lookup(fieldType);
							if (nestedType && (nestedType as any).valuesById) {
								enumValues = Object.values((nestedType as any).valuesById) as string[];
							} else if (nestedType && !visitedTypes.has(fieldType)) {
								visitedTypes.add(fieldType);
								const nestedDefinition = this.extractMessageTypeDefinition(fieldType, visitedTypes);
								nestedFields = nestedDefinition.fields;
								visitedTypes.delete(fieldType);
							}
						} catch (e) {
							console.warn(`[DescriptorParser] Failed to lookup nested type ${fieldType}:`, e);
						}
					}

					const fieldDef: MessageField = {
						name: fieldName,
						type: fieldType,
						rule: rule === 'repeated' ? 'repeated' : rule === 'required' ? 'required' : 'optional',
						comment,
						nested: isNested && !enumValues,
					};

					if (enumValues) {
						fieldDef.enumValues = enumValues;
					}

					if (nestedFields && nestedFields.length > 0) {
						fieldDef.nestedFields = nestedFields;
					}

					fields.push(fieldDef);
				}
			}

			return {
				name: message.name,
				fullName: typeName,
				fields,
			};
		} catch (error) {
			console.error(`[DescriptorParser] Failed to extract message type definition for ${typeName}:`, error);
			return {
				name: typeName.split('.').pop() || typeName,
				fullName: typeName,
				fields: [],
			};
		}
	}
}
