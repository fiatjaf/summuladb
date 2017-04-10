package main

import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/summadb/summadb/database"
	"github.com/summadb/summadb/types"
)

func main() {
	js.Module.Set("exports", func(name, adapter string) summula {
		path := types.Path{}
		return newDatabase(name, adapter, path)
	})
}

type summula map[string]interface{}

func newDatabase(name, adapter string, path types.Path) summula {
	summa := database.Open(name, adapter)

	return map[string]interface{}{
		"root": func(rawpath string) summula {
			return newDatabase(name, adapter, types.Path{})
		},
		"path": func(rawpath string) summula {
			return newDatabase(name, adapter, types.ParsePath(rawpath))
		},
		"child": func(keys ...string) summula {
			newpath := path.Copy()
			for _, key := range keys {
				newpath = append(newpath, key)
			}
			return newDatabase(name, adapter, newpath)
		},
		"parent": func() summula {
			return newDatabase(name, adapter, path.Parent())
		},
		"rev": func() *js.Object {
			return js.Global.Get("Promise").New(func(resolve, reject *js.Object) {
				go func() {
					rev, err := summa.Rev(path)
					if err != nil {
						reject.Invoke(jsErr(err))
						return
					}
					resolve.Invoke(rev)
				}()
			})
		},
		"set": func(doc map[string]interface{}) *js.Object {
			return js.Global.Get("Promise").New(func(resolve, reject *js.Object) {
				go func() {
					tree := types.TreeFromInterface(doc)
					err := summa.Set(path, tree)
					if err != nil {
						reject.Invoke(jsErr(err))
						return
					}
					resolve.Invoke()
				}()
			})
		},
		"merge": func(doc map[string]interface{}) *js.Object {
			return js.Global.Get("Promise").New(func(resolve, reject *js.Object) {
				go func() {
					tree := types.TreeFromInterface(doc)
					err := summa.Merge(path, tree)
					if err != nil {
						reject.Invoke(jsErr(err))
						return
					}
					resolve.Invoke()
				}()
			})
		},
		"delete": func(rev string) *js.Object {
			return js.Global.Get("Promise").New(func(resolve, reject *js.Object) {
				go func() {
					err := summa.Delete(path, rev)
					if err != nil {
						reject.Invoke(jsErr(err))
						return
					}
					resolve.Invoke()
				}()
			})
		},
		"read": func() *js.Object {
			return js.Global.Get("Promise").New(func(resolve, reject *js.Object) {
				go func() {
					tree, err := summa.Read(path)
					if err != nil {
						reject.Invoke(jsErr(err))
						return
					}
					resolve.Invoke(tree.ToInterface())
				}()
			})
		},
		"records": func(params map[string]interface{}) *js.Object {
			return js.Global.Get("Promise").New(func(resolve, reject *js.Object) {
				go func() {
					defer func() {
						if r := recover(); r != nil {
							reject.Invoke(jsErr(r.(error)))
						}
					}()

					recordsparams := database.RecordsParams{}
					if param, given := params["key_start"]; given {
						if value, correcttype := param.(string); correcttype {
							recordsparams.KeyStart = value
						}
					}
					if param, given := params["key_end"]; given {
						if value, correcttype := param.(string); correcttype {
							recordsparams.KeyEnd = value
						}
					}
					if param, given := params["descending"]; given {
						if value, correcttype := param.(bool); correcttype {
							recordsparams.Descending = value
						}
					}
					if param, given := params["limit"]; given {
						if value, correcttype := param.(float64); correcttype {
							recordsparams.Limit = int(value)
						}
					}

					trees, err := summa.Records(path, recordsparams)
					if err != nil {
						reject.Invoke(jsErr(err))
						return
					}

					records := make([]interface{}, len(trees))
					for i, tree := range trees {
						records[i] = tree.ToInterface()
					}

					resolve.Invoke(records)
				}()
			})
		},
		"erase": func() {
			go func() {
				summa.Erase()
			}()
		},
	}
}

func jsErr(err error) map[string]interface{} {
	return map[string]interface{}{
		"message": err.Error(),
	}
}
