package main

import (
	"github.com/fiatjaf/summadb/database"
	"github.com/gopherjs/gopherjs/js"
)

func main() {
	js.Module.Set("exports", NewDatabase)
}

func NewDatabase(name string, adapter string) *database.SummaDB {
	db := database.Open(name, adapter)
	return db
}
