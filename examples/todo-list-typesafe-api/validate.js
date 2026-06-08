// validate.js v0.1.1
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Copyright (c) 2026 Jake Lazaroff https://github.com/jakelazaroff/validate.js

// STANDARD SCHEMA TYPES
// See https://standardschema.dev

/**
 * @template [Input=unknown]
 * @template [Output=Input]
 * @typedef {{ readonly "~standard": Props<Input, Output> }} StandardSchemaV1
 */

/**
 * @template [Input=unknown]
 * @template [Output=Input]
 * @typedef {object} Props
 * @property {1} version
 * @property {string} vendor
 * @property {(value: unknown) => Result<Output>} validate
 * @property {Types<Input, Output> | undefined} [types]
 */

/**
 * @template Output
 * @typedef {SuccessResult<Output> | FailureResult} Result
 */

/**
 * @template Output
 * @typedef {object} SuccessResult
 * @property {Output} value
 * @property {undefined} [issues]
 */

/**
 * @typedef {object} FailureResult
 * @property {ReadonlyArray<Issue>} issues
 */

/**
 * @typedef {object} Issue
 * @property {string} message
 * @property {ReadonlyArray<PropertyKey>} [path]
 */

/**
 * @template [Input=unknown]
 * @template [Output=Input]
 * @typedef {object} Types
 * @property {Input} input
 * @property {Output} output
 */

/**
 * @template {StandardSchemaV1} Schema
 * @typedef {NonNullable<Schema['~standard']['types']>['output']} InferOutput
 */

// IMPLEMENTATION

const NS = "~standard"

class SchemaError extends Error {
	/** @param {readonly Issue[]} issues */
	constructor(issues) {
		const msg = issues
			.map(({message, path}) => (path?.length ? `- $.${path?.join(".")}: ${message}` : message))
			.join("\n")
		super(msg)
	}
}

/**
 * Creates a schema from a validation function.
 * @template [Input=unknown]
 * @template [Output=Input]
 * @param {(input: any) => Result<Output>} validate The validation function.
 * @returns {StandardSchemaV1<Input, Output>}
 */
function schema(validate) {
	return {
		[NS]: {
			version: 1,
			vendor: "validate",
			validate
		}
	}
}

/**
 * Validates a given input against a schema.
 * @template T
 * @param {StandardSchemaV1<any, T>} schm
 * @param {any} input
 */
const v = (schm, input) => schm[NS].validate(input)

/**
 * Creates a schema from a type predicate.
 * @template [Input=unknown]
 * @template [Output=Input]
 * @param {(value: unknown) => value is Output} fn The validation function.
 * @param {(value: unknown) => string} msg
 * @returns {StandardSchemaV1<Input, Output>}
 */
export function custom(fn, msg) {
	return schema(value => {
		if (fn(value)) return /** @type {SuccessResult<Output>} */ ({value})
		return {issues: [{message: msg(value), path: []}]}
	})
}

/**
 * @param {string} e Expected type
 * @param {string} a Actual type
 */
function formatErr(e, a) {
	return `Expected ${e}, received \`${JSON.stringify(a)}\``
}

/** @param {string} e Expected type */
function formatErrFor(e) {
	/** @param {any} a */
	return a => formatErr(e, a)
}

// schemata for `null` and `undefined` (defined in a way that avoids shadowing built-ins)
const _null = custom(x => x === null, formatErrFor("null"))
const _undefined = custom(x => x === undefined, formatErrFor("undefined"))
export {_null as null, _undefined as undefined}

export const bigint = custom(x => typeof x === "bigint", formatErrFor("bigint"))
export const boolean = custom(x => typeof x === "boolean", formatErrFor("boolean"))
export const number = custom(x => typeof x === "number", formatErrFor("number"))
export const string = custom(x => typeof x === "string", formatErrFor("string"))
export const symbol = custom(x => typeof x === "symbol", formatErrFor("symbol"))
export const any = custom(
	/** @returns {_ is any} */ _ => true,
	() => ""
)

/**
 * @template const T
 * @param {T} lit
 */
export const literal = lit =>
	custom(
		/** @returns {val is T} */
		val => val === lit,
		formatErrFor(`\`${lit}\``)
	)

/**
 * @template {abstract new (...args: any) => any} T
 * @param {T} fn
 */
export const instance = fn =>
	custom(
		/** @returns {v is InstanceType<T>} */
		v => v instanceof fn,
		formatErrFor(`instance of ${fn.name}`)
	)

/**
 * @template {StandardSchemaV1[]} T
 * @param {T} schemata
 * @returns {StandardSchemaV1<unknown, InferOutput<T[number]>>}
 */
export const union = (...schemata) => {
	return schema(input => {
		/** @type {Issue[]} */
		let issues = []

		for (const schm of schemata) {
			const result = v(schm, input)
			if (!result.issues) return result
			issues = issues.concat(result.issues)
		}

		return {issues}
	})
}

/**
 * Simplifies an intersection type into a single object type
 * @template T
 * @typedef {T extends infer O ? { [K in keyof O]: O[K] } : never} Simplify
 */

/**
 * Recursively intersects the output types of a tuple of schemas,
 * preserving unions within individual schemas.
 * @template {StandardSchemaV1[]} T
 * @typedef {T extends [infer F extends StandardSchemaV1, ...infer R extends StandardSchemaV1[]] ? InferOutput<F> & IntersectOutputs<R> : unknown} IntersectOutputs
 */

/**
 * @template {StandardSchemaV1[]} T
 * @param {T} schemata
 * @returns {StandardSchemaV1<unknown, Simplify<IntersectOutputs<T>>>}
 */
export const intersect = (...schemata) => {
	return schema(value => {
		/** @type {Issue[]} */
		let issues = []

		for (const schm of schemata) {
			const result = v(schm, value)
			if (result.issues) issues = issues.concat(result.issues)
		}

		return issues.length ? {issues} : {value}
	})
}

/**
 * @template {StandardSchemaV1} T
 * @param {T} schm
 */
export const optional = schm => union(_undefined, schm)

/**
 * @template {StandardSchemaV1} T
 * @param {T} schm
 */
export const nullable = schm => union(_null, schm)

/**
 * @template T
 * @param {StandardSchemaV1<unknown, T>} schm
 * @returns {StandardSchemaV1<unknown, T[]>}
 */
export const array = schm => {
	return schema(value => {
		if (!Array.isArray(value)) return {issues: [{message: formatErr("array", value)}]}

		/** @type {Issue[]} */
		const issues = []

		for (const [i, val] of value.entries()) {
			const result = v(schm, val)
			if (result.issues) {
				for (const issue of result.issues) {
					issue.path = /** @type {PropertyKey[]} */ ([i]).concat(issue.path || [])
					issues.push(issue)
				}
			}
		}

		if (issues.length) return {issues}
		return /** @type {SuccessResult<T[]>} */ ({value})
	})
}

/** @param {any} input */
function isObject(input) {
	return typeof input === "object" && input !== null && !Array.isArray(input)
}

/**
 * @template {{ [key: PropertyKey]: StandardSchemaV1}} T
 * @param {T} schm
 * @returns {StandardSchemaV1<unknown, Simplify<
 *   { [K in keyof T as undefined extends InferOutput<T[K]> ? never : K]: InferOutput<T[K]> } &
 *   { [K in keyof T as undefined extends InferOutput<T[K]> ? K : never]?: InferOutput<T[K]> }
 * >>}
 */
export const object = schm => {
	return schema(value => {
		if (!isObject(value)) return {issues: [{message: formatErr("object", value)}]}

		/** @type {Issue[]} */
		const issues = []

		for (const [key, subschm] of Object.entries(schm)) {
			const result = v(subschm, value[key])
			if (result.issues) {
				for (const issue of result.issues || []) {
					issue.path = /** @type {[PropertyKey]} */ ([key]).concat(issue.path || [])
					issues.push(issue)
				}
			}
		}

		return issues.length ? {issues} : {value}
	})
}

/**
 * @template T
 * @param {StandardSchemaV1<unknown, T>} schm
 * @returns {StandardSchemaV1<unknown, { [key: PropertyKey]: T }>}
 */
export const record = schm => {
	return schema(value => {
		if (!isObject(value)) return {issues: [{message: formatErr("object", value)}]}

		/** @type {Issue[]} */
		const issues = []

		for (const [key, val] of Object.entries(value)) {
			const result = v(schm, val)
			if (result.issues) {
				for (const issue of result.issues || []) {
					issue.path = /** @type {[PropertyKey]} */ ([key]).concat(issue.path || [])
					issues.push(issue)
				}
			}
		}

		return issues.length ? {issues} : {value}
	})
}

/**
 * @template [Input=unknown]
 * @template [Output=Input]
 * @param {StandardSchemaV1<Input, Output>} schm
 * @param {unknown} input
 * @throws {SchemaError}
 * @returns {Output}
 */
export function parse(schm, input) {
	const result = v(schm, input)
	if (result.issues) throw new SchemaError(result.issues)
	return result.value
}

/**
 * @template [Input=unknown]
 * @template [Output=Input]
 * @param {StandardSchemaV1<Input, Output>} schm
 * @param {unknown} input
 * @returns {input is Output}
 */
export function is(schm, input) {
	return !v(schm, input).issues
}
