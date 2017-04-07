const tape = require('blue-tape')
const SummulaDB = require('./summuladb')

const db = SummulaDB('something', 'memdown')

tape('basic', function (t) {
  t.ok(db, 'db was created.')
  t.equals(typeof db.set, 'function', '.set is a function that exists')
  t.equals(typeof db.read, 'function', '.read is a function that exists')
  return db.set({hello: 'world'})
    .then(() => db.read())
    .then(doc => {
      t.equal(doc._rev.slice(0, 2), '1-', 'top level _rev')
      t.equal(doc.hello._rev.slice(0, 2), '1-', 'nested _rev')
      t.equal(doc.hello._val, 'world', 'value')
    })
})
