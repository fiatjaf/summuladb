const tape = require('blue-tape')
const delay = require('delay')
const SummulaDB = typeof window !== 'undefined' && window.SummulaDB || require('./summuladb')

function newdb () {
  return SummulaDB(Math.random(), 'memdown')
}

var db

// tape.onFinish(function () {
//   db.read().then(full => console.log('db contents on end: ', JSON.stringify(full, null, 2)))
// })

tape('basic', function (t) {
  db = newdb()
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

tape('path operations', function (t) {
  db = newdb()
  return db.set({fruits: {1: {name: 'melon'}, 2: {name: 'orange'}}})
    .then(() => db.child('fruits').child('1').child('name').read())
    .then(name => {
      t.equal(name._val, 'melon', 'fruits/1/name == melon')
      return db.path('fruits/1').read()
    })
    .then(fruit => {
      t.equal(fruit.name._val, 'melon', 'fruits/1.name == melon')
      db = db.child('fruits').child('1')
      return db.merge({flavour: 'weird', _rev: fruit._rev})
    })
    .then(() => db.path('fruits/1/flavour').read())
    .then(flavour => {
      t.equal(flavour._rev.slice(0, 2), '1-', 'fruits/1/flavour _rev')
      t.equal(flavour._val, 'weird', 'fruits/1/flavour == weird')
      return db.root().read()
    })
    .then(root => {
      t.equal(root._rev.slice(0, 2), '2-', 'root _rev')
      t.equal(root.fruits._rev.slice(0, 2), '2-', 'fruits _rev')
      t.equal(root.fruits['1']._rev.slice(0, 2), '2-', 'first fruit _rev')
      t.equal(root.fruits['2']._rev.slice(0, 2), '1-', 'second fruit _rev')
      t.equal(root.fruits['1'].name._val, 'melon', 'values')
      t.equal(root.fruits['2'].name._val, 'orange')
      t.equal(root.fruits['1'].flavour._val, 'weird')
    })
})

tape('some other operations', function (t) {
  db = newdb()
  return db.set({birds: {}, mammals: {ornitorrinco: true, coelho: true}})
    .then(() => db.child('mammals').records({key_start: 'ola'}))
    .then(rows => {
      t.equal(rows.length, 1, 'got 1 mammal row')
      return db.rev()
    })
    .then(rootrev =>
      db.merge({
        _rev: rootrev,
        mammals: {
          girafa: true,
          coelho: 2,
          ornitorrinco: {_del: true, name: 'orni'}
        },
        birds: {
          'sabiá': true,
          galinha: true
        }
      })
    )
    .then(() => db.path('mammals/ornitorrinco').read())
    .then(orn => {
      t.equal(orn._del, true, 'ornitorrinco was deleted')
      t.deepEqual(Object.keys(orn).length, 3, 'ornitorrinco has 3 keys')
      t.equal(orn._rev.slice(0, 2), '2-', 'rev is correct')
      t.equal(orn.name._val, 'orni', 'deleted node has a child with a value')
      return db.child('birds').records({descending: true, limit: 1})
    })
    .then(birds => {
      t.equal(birds.length, 1, 'fetched 1 bird only')
      t.equal(birds[0]._key, 'sabiá', 'birds fetched is the last one')
      t.equal(birds[0]._rev.slice(0, 2), '1-', 'sábia rev is correct')
      return db.child('mammals').records()
    })
    .then(mammals => {
      t.equal(mammals.length, 2, 'two mammals lasted')
      t.equal(mammals[0]._val, 2, 'coelho has changed to a number')
      t.equal(mammals[0]._rev.slice(0, 2), '2-', 'coelho _rev was bumped to 2')
      t.equal(mammals[1]._val, true, 'girafa has _val=true')
      t.equal(mammals[1]._rev.slice(0, 2), '1-', 'girafa _rev is at starting point 1-')
      return db.path('mammals').rev()
    })
    .then(rev => db.child('mammals').delete(rev))
    .then(() => db.path('mammals').read())
    .then(mammals => {
      let orn = mammals.ornitorrinco
      t.equal(orn._del, true, 'ornitorrinco is still deleted')
      t.equal(Object.keys(orn).length, 3, 'ornitorrinco has 3 keys (because it has a child)')
      t.equal(orn._rev.slice(0, 2), '2-', 'ornitorrinco _rev continues the same after mammals was deleted')
      let girafa = mammals.girafa
      t.equal(girafa._del, true, 'girafa is now deleted')
      t.equal(Object.keys(girafa).length, 2, 'girafa has 2 keys (_rev and _del)')
      t.equal(girafa._rev.slice(0, 2), '2-', 'girafa _rev has been bumped')
      return db.child('mammals').read()
    })
})

tape('map functions', function (t) {
  db = newdb()
  return db.set({
    days: {
      '2017-04-09': {
        '13h45': {
          orange: 10,
          banana: 13.5
        },
        '14h04': {
          melon: 9,
          coffee: 34
        }
      },
      '2017-04-10': {
        '13h34': {
          juice: 5.50
        },
        '13h56': {
          soup: 12,
          orange: 12
        },
        '14h12': {
          banana: 12.5,
          coffee: 33.7
        }
      },
      '!map': `
local i = 0
for time, items in pairs(doc) do
  for name, value in pairs(items) do
    emit('sales', name .. ":" ..  _key .. ":" .. i, value)
    i = i + 1
  end
end
      `
    }
  })
  .then(delay(300))
  .then(() => db.child('days', '!map', 'sales').read())
  .then(sales => {
    t.equal(Object.keys(sales).length, 9, 'got correct number of sales')
    return db.path('days/!map/sales').records({
      key_start: 'c',
      key_end: 'mi',
      descending: true
    })
  })
  .then(sales => {
    t.equal(sales.length, 4, 'got correct number of records')
    t.equal(sales[0]._key.split(':')[0], 'melon', 'first record is the last with descending')
    t.equal(sales.slice(-1)[0]._val, 34, 'last record is the first with descending')
  })
})
