(module
 (type $ii (func (param i32) (result i32)))
 (type $v (func))
 (global $HEAP_BASE i32 (i32.const 4))
 (memory $0 1)
 (export "alias" (func $typealias/alias))
 (export "memory" (memory $0))
 (start $start)
 (func $typealias/alias (; 0 ;) (type $ii) (param $0 i32) (result i32)
  ;;@ typealias.ts:4:9
  (return
   (get_local $0)
  )
 )
 (func $start (; 1 ;) (type $v)
  (nop)
 )
)
