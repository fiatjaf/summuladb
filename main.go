package main

import (
	"github.com/fiatjaf/summadb/database"
	"github.com/fiatjaf/summadb/types"
	"github.com/gopherjs/gopherjs/js"
)

func main() {
	js.Module.Set("exports", func(name string, adapter string) map[string]interface{} {
		summa := database.Open(name, adapter)
		path := types.Path{}

		return map[string]interface{}{
			"set": func(doc map[string]interface{}) *js.Object {
				return js.Global.Get("Promise").New(func(resolve, reject *js.Object) {
					go func() {
						tree := types.TreeFromInterface(doc)
						resolve.Invoke(summa.Set(path, tree))
					}()
				})
			},
			"read": func() *js.Object {
				return js.Global.Get("Promise").New(func(resolve, reject *js.Object) {
					go func() {
						tree, err := summa.Read(path)
						if err != nil {
							reject.Invoke(err)
							return
						}
						resolve.Invoke(tree.ToInterface())
					}()
				})
			},
		}
	})
}
