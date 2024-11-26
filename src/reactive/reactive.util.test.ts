import { assertEquals } from 'jsr:@std/assert'
import { parseBind } from './reactive.util.ts'

Deno.test('parseBind', () => {
  assertEquals(
    parseBind('value'),
    { prop: 'innerHTML', subprop: undefined, fieldOrMethod: 'value', args: [] },
  )

  assertEquals(
    parseBind("fn('str', 7, true,false)"),
    { prop: 'innerHTML', subprop: undefined, fieldOrMethod: 'fn', args: ['str', 7, true, false] },
  )

  assertEquals(
    parseBind('required=value'),
    { prop: 'required', subprop: undefined, fieldOrMethod: 'value', args: [] },
  )

  assertEquals(
    parseBind('style.display = value'),
    { prop: 'style', subprop: 'display', fieldOrMethod: 'value', args: [] },
  )

  assertEquals(
    parseBind("prop.subprop = fn('str')"),
    { prop: 'prop', subprop: 'subprop', fieldOrMethod: 'fn', args: ['str'] },
  )
})
