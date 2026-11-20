type BindArg = string | number | boolean

type ParsedBind = {
  prop?: string
  subprop?: string
  fieldOrMethod?: string
  args: BindArg[]
  error?: string
}

export const parseBind = (bind: string): ParsedBind => {
  const parts = bind.split('=')
  const [lhs, rhs] = parts.length === 2
    ? [parts[0]!.trim(), parts[1]!.trim()]
    : ['innerHTML', bind.trim()]

  const [prop, subprop] = lhs.split('.') as Array<string | undefined>
  if (!prop) {
    return { error: 'Found invalid data-bind value', args: [] }
  }

  const [fieldOrMethod, rawArgs] = rhs.split('(')
  const args = parseArgs(rawArgs)
  return { prop, subprop, fieldOrMethod, args }
}

export const parseArgs = (rawArgs: string | undefined): BindArg[] => {
  if (!rawArgs) return []
  if (rawArgs.endsWith(')')) {
    rawArgs = rawArgs.slice(0, -1)
  }
  return rawArgs.split(',').map(a => a.trim())
    .map(a => {
      if (a.startsWith("'") && a.endsWith("'")) {
       return a.slice(1, -1)
      } else if (a === 'true') {
        return true
      } else if (a === 'false') {
        return false
      } else {
        const n = parseFloat(a)
        return isNaN(n) ? a : n
      }
    })
}
