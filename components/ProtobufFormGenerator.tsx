"use client";

import {
	AlertCircle,
	ChevronDown,
	ChevronRight,
	Plus,
	Trash2,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { MessageField, MessageTypeDefinition } from "@/lib/types/grpc";
import { cn } from "@/lib/utils";

/** Proto3 JSON maps these well-known types to plain JSON values. */
const JSON_WELL_KNOWN_TYPES = new Set([
	"google.protobuf.Struct",
	"google.protobuf.Value",
	"google.protobuf.ListValue",
]);

interface ProtobufFormGeneratorProps {
	messageType: MessageTypeDefinition;
	value: Record<string, any>;
	onChange: (value: Record<string, any>) => void;
	readonly?: boolean;
}

const ProtobufFormGenerator: React.FC<ProtobufFormGeneratorProps> = ({
	messageType,
	value,
	onChange,
	readonly = false,
}) => {
	// If no fields, show empty state (methods with no parameters)
	if (!messageType.fields || messageType.fields.length === 0) {
		return (
			<div className="flex items-center justify-center h-32 text-muted-foreground">
				<div className="text-center">
					<AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
					<p className="text-sm">No input parameters required</p>
					<p className="text-xs mt-1">This method accepts an empty request</p>
				</div>
			</div>
		);
	}

	const handleFieldChange = (fieldName: string, fieldValue: any) => {
		onChange({
			...value,
			[fieldName]: fieldValue,
		});
	};

	return (
		<div className="space-y-4">
			{messageType.fields.map((field) => (
				<FieldInput
					key={field.name}
					field={field}
					value={value[field.name]}
					onChange={(v) => handleFieldChange(field.name, v)}
					readonly={readonly}
				/>
			))}
		</div>
	);
};

interface FieldInputProps {
	field: MessageField;
	value: any;
	onChange: (value: any) => void;
	readonly?: boolean;
}

const FieldInput: React.FC<FieldInputProps> = ({
	field,
	value,
	onChange,
	readonly = false,
}) => {
	const [expanded, setExpanded] = useState(true);

	// Struct/Value/ListValue are plain JSON in proto3 JSON, so show a JSON editor
	// instead of expanding their internal (map/oneof) plumbing.
	const wellKnownType = field.type.replace(/^\./, "");
	if (JSON_WELL_KNOWN_TYPES.has(wellKnownType)) {
		const repeated = field.rule === "repeated";
		const placeholder = repeated
			? wellKnownType === "google.protobuf.Value"
				? '[1, "two"]'
				: '[{"key": "value"}]'
			: wellKnownType === "google.protobuf.ListValue"
				? '["value", 1, true]'
				: wellKnownType === "google.protobuf.Value"
					? '"value" or {"key": "value"}'
					: '{"key": "value"}';
		return (
			<div className="border border-border rounded-lg p-3 bg-muted/30">
				<span className="text-sm font-medium text-foreground mb-2 block">
					{field.name}
					<span className="ml-2 text-xs text-muted-foreground">
						({field.type}
						{repeated ? "[]" : ""})
					</span>
				</span>
				{field.comment && (
					<p className="text-xs text-muted-foreground mb-2">{field.comment}</p>
				)}
				<JsonValueInput
					value={value}
					onChange={onChange}
					readonly={readonly}
					placeholder={placeholder}
					expectsArray={repeated}
					ariaLabel={field.name}
				/>
			</div>
		);
	}

	// Repeated field (array)
	if (field.rule === "repeated") {
		const arrayValue = Array.isArray(value) ? value : [];
		// The element editor is the same field without the repeated rule, so
		// message entries get the nested editor instead of a text box.
		const { rule: _rule, ...itemField } = field;
		const handleArrayChange = (nextArray: any[]) => onChange(nextArray);

		return (
			<div className="border border-border rounded-lg p-3">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setExpanded(!expanded)}
							className="p-0.5 hover:bg-muted rounded"
						>
							{expanded ? (
								<ChevronDown className="h-4 w-4 text-muted-foreground" />
							) : (
								<ChevronRight className="h-4 w-4 text-muted-foreground" />
							)}
						</button>
						<span className="text-sm font-medium text-foreground">
							{field.name}
							<span className="ml-2 text-xs text-muted-foreground">
								({field.type}[])
							</span>
						</span>
					</div>
					{!readonly && (
						<button
							type="button"
							onClick={() =>
								handleArrayChange([...arrayValue, field.nested ? {} : ""])
							}
							className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
						>
							<Plus className="h-3 w-3" />
							Add
						</button>
					)}
				</div>
				{field.comment && (
					<p className="text-xs text-muted-foreground mb-2">{field.comment}</p>
				)}
				{expanded && (
					<div className="space-y-2 mt-2 max-h-96 overflow-y-auto">
						{arrayValue.length === 0 ? (
							<div className="text-xs text-muted-foreground italic py-2">
								Empty array - click &quot;Add&quot; to add items
							</div>
						) : (
							arrayValue.map((item: any, index: number) => (
								<div key={index} className="flex items-center gap-2">
									<div className="flex-1">
										{field.nested ? (
											<FieldInput
												field={itemField}
												value={item}
												onChange={(v) =>
													handleArrayChange(
														arrayValue.map((prev: any, i: number) =>
															i === index ? v : prev,
														),
													)
												}
												readonly={readonly}
											/>
										) : (
											<PrimitiveInput
												type={field.type}
												value={item}
												onChange={(v) =>
													handleArrayChange(
														arrayValue.map((prev: any, i: number) =>
															i === index ? v : prev,
														),
													)
												}
												{...(field.enumValues && {
													enumValues: field.enumValues,
												})}
												readonly={readonly}
												placeholder={`Item ${index + 1}`}
											/>
										)}
									</div>
									{!readonly && (
										<button
											type="button"
											onClick={() =>
												handleArrayChange(
													arrayValue.filter((_: any, i: number) => i !== index),
												)
											}
											className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
										>
											<Trash2 className="h-4 w-4" />
										</button>
									)}
								</div>
							))
						)}
					</div>
				)}
			</div>
		);
	}

	// Nested message field
	if (field.nested) {
		// If we have nested field definitions, render them as expandable fields
		if (field.nestedFields && field.nestedFields.length > 0) {
			const nestedValue = value || {};

			return (
				<div className="border border-border rounded-lg p-3 bg-muted/30">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setExpanded(!expanded)}
								className="p-0.5 hover:bg-muted rounded"
							>
								{expanded ? (
									<ChevronDown className="h-4 w-4 text-muted-foreground" />
								) : (
									<ChevronRight className="h-4 w-4 text-muted-foreground" />
								)}
							</button>
							<span className="text-sm font-medium text-foreground">
								{field.name}
								<span className="ml-2 text-xs text-muted-foreground">
									({field.type})
								</span>
							</span>
						</div>
					</div>
					{field.comment && (
						<p className="text-xs text-muted-foreground mb-2">
							{field.comment}
						</p>
					)}
					{expanded && (
						<div className="space-y-3 mt-2 pl-4 border-l-2 border-border">
							{field.nestedFields.map((nestedField) => (
								<FieldInput
									key={nestedField.name}
									field={nestedField}
									value={nestedValue[nestedField.name]}
									onChange={(v) => {
										const updated = { ...nestedValue, [nestedField.name]: v };
										onChange(updated);
									}}
									readonly={readonly}
								/>
							))}
						</div>
					)}
				</div>
			);
		}

		// Fallback: if no nested fields available, use JSON editor
		return (
			<div className="border border-border rounded-lg p-3 bg-muted/30">
				<span className="text-sm font-medium text-foreground mb-2 block">
					{field.name}
					<span className="ml-2 text-xs text-muted-foreground">
						({field.type})
					</span>
				</span>
				{field.comment && (
					<p className="text-xs text-muted-foreground mb-2">{field.comment}</p>
				)}
				<div className="text-xs text-muted-foreground italic py-2">
					Nested message - use JSON editor for complex types
				</div>
				<JsonValueInput
					value={value}
					onChange={onChange}
					readonly={readonly}
					placeholder={`{"field": "value"}`}
					ariaLabel={field.name}
				/>
			</div>
		);
	}

	// Regular field
	return (
		<div>
			<label
				htmlFor={`field-${field.name}`}
				className="text-sm font-medium text-foreground mb-1.5 block"
			>
				{field.name}
				{field.rule === "required" && (
					<span className="ml-1 text-destructive">*</span>
				)}
				<span className="ml-2 text-xs text-muted-foreground">
					({field.type})
				</span>
			</label>
			{field.comment && (
				<p className="text-xs text-muted-foreground mb-1.5">{field.comment}</p>
			)}
			<PrimitiveInput
				id={`field-${field.name}`}
				type={field.type}
				value={value}
				onChange={onChange}
				{...(field.enumValues && { enumValues: field.enumValues })}
				readonly={readonly}
				placeholder={`Enter ${field.name}`}
			/>
		</div>
	);
};

interface JsonValueInputProps {
	value: any;
	onChange: (value: any) => void;
	readonly?: boolean;
	placeholder?: string;
	ariaLabel?: string;
	/** Reject parsed values that are not arrays (repeated well-known fields). */
	expectsArray?: boolean;
}

/**
 * Textarea that edits a value as JSON. Local text is kept as typed so partially
 * valid input does not get reformatted; the last valid parse is what propagates.
 */
const JsonValueInput: React.FC<JsonValueInputProps> = ({
	value,
	onChange,
	readonly = false,
	placeholder,
	ariaLabel,
	expectsArray = false,
}) => {
	const serialize = (v: any) =>
		v === undefined ? "" : JSON.stringify(v, null, 2);
	const serialized = serialize(value);
	const [text, setText] = useState(serialized);
	const [error, setError] = useState<string | null>(null);
	const emitted = useRef(serialized);

	useEffect(() => {
		if (serialized === emitted.current) return;
		emitted.current = serialized;
		setText(serialized);
		setError(null);
	}, [serialized]);

	const handleChange = (next: string) => {
		setText(next);
		if (!next.trim()) {
			emitted.current = "";
			setError(null);
			onChange(undefined);
			return;
		}
		try {
			const parsed = JSON.parse(next);
			if (expectsArray && !Array.isArray(parsed)) {
				setError("Expected a JSON array");
				return;
			}
			emitted.current = serialize(parsed);
			setError(null);
			onChange(parsed);
		} catch (err) {
			setError((err as Error).message);
		}
	};

	return (
		<>
			<textarea
				aria-label={ariaLabel}
				value={text}
				onChange={(e) => handleChange(e.target.value)}
				readOnly={readonly}
				placeholder={placeholder}
				className={cn(
					"w-full px-3 py-2 rounded text-sm font-mono",
					"bg-input border border-border",
					"focus:outline-none focus:ring-2 focus:ring-primary",
					readonly && "bg-muted cursor-not-allowed",
					error && "border-destructive",
				)}
				rows={4}
			/>
			{error && (
				<p className="text-xs text-destructive mt-1">Invalid JSON: {error}</p>
			)}
		</>
	);
};

interface PrimitiveInputProps {
	id?: string;
	type: string;
	value: any;
	onChange: (value: any) => void;
	enumValues?: string[];
	readonly?: boolean;
	placeholder?: string;
}

const PrimitiveInput: React.FC<PrimitiveInputProps> = ({
	id,
	type,
	value,
	onChange,
	enumValues,
	readonly = false,
	placeholder,
}) => {
	// Enum select
	if (enumValues && enumValues.length > 0) {
		return (
			<select
				id={id}
				value={value || ""}
				onChange={(e) => onChange(e.target.value)}
				disabled={readonly}
				className={cn(
					"w-full px-3 py-2 rounded text-sm",
					"bg-input border border-border",
					"focus:outline-none focus:ring-2 focus:ring-primary",
					readonly && "bg-muted cursor-not-allowed",
				)}
			>
				<option value="">Select value...</option>
				{enumValues.map((enumValue) => (
					<option key={enumValue} value={enumValue}>
						{enumValue}
					</option>
				))}
			</select>
		);
	}

	// Boolean checkbox
	if (type === "bool") {
		return (
			<label className="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					checked={value || false}
					onChange={(e) => onChange(e.target.checked)}
					disabled={readonly}
					className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
				/>
				<span className="text-sm text-muted-foreground">
					{value ? "true" : "false"}
				</span>
			</label>
		);
	}

	// Number input for numeric types
	if (
		[
			"int32",
			"int64",
			"uint32",
			"uint64",
			"sint32",
			"sint64",
			"fixed32",
			"fixed64",
			"sfixed32",
			"sfixed64",
			"double",
			"float",
		].includes(type)
	) {
		return (
			<input
				id={id}
				type="number"
				value={value || ""}
				onChange={(e) => {
					const numValue =
						type.includes("float") || type === "double"
							? parseFloat(e.target.value)
							: parseInt(e.target.value, 10);
					onChange(Number.isNaN(numValue) ? "" : numValue);
				}}
				readOnly={readonly}
				placeholder={placeholder || "Enter number"}
				className={cn(
					"w-full px-3 py-2 rounded text-sm",
					"bg-input border border-border",
					"focus:outline-none focus:ring-2 focus:ring-primary",
					readonly && "bg-muted cursor-not-allowed",
				)}
			/>
		);
	}

	// Bytes as base64 textarea
	if (type === "bytes") {
		return (
			<textarea
				id={id}
				value={value || ""}
				onChange={(e) => onChange(e.target.value)}
				readOnly={readonly}
				placeholder={placeholder || "Enter base64 encoded bytes"}
				className={cn(
					"w-full px-3 py-2 rounded text-sm font-mono",
					"bg-input border border-border",
					"focus:outline-none focus:ring-2 focus:ring-primary",
					readonly && "bg-muted cursor-not-allowed",
				)}
				rows={3}
			/>
		);
	}

	// String input (default)
	return (
		<input
			id={id}
			type="text"
			value={value || ""}
			onChange={(e) => onChange(e.target.value)}
			readOnly={readonly}
			placeholder={placeholder || "Enter text"}
			className={cn(
				"w-full px-3 py-2 rounded text-sm",
				"bg-input border border-border",
				"focus:outline-none focus:ring-2 focus:ring-primary",
				readonly && "bg-muted cursor-not-allowed",
			)}
		/>
	);
};

export default ProtobufFormGenerator;
