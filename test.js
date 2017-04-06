const tape = require('tape')
const SummulaDB = require('./summuladb')

const db = SummulaDB('something', 'memdown')

tape('basic', function (t) {
  t.plan(1)
  t.ok(db, 'db was created.')
})

