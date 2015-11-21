var crypto = require('crypto')
var rabin = require('rabin')
var through = require('through2')
var bulk = require('bulk-write-stream')
var pumpify = require('pumpify')
var merkleStream = require('merkle-tree-stream')
var hash = require('./hash')
var messages = require('./messages')

var BATCH_OPTIONS = {highWaterMark: 64}

module.exports = treeStream

function treeStream (db, opts) {
  if (!opts) opts = {}

  var pointer = crypto.randomBytes(32).toString('hex')
  var merkle = merkleStream(hash)
  var indexer = null
  var blocks = 0
  var offset = 0
  var filename = opts.filename

  var pipeline = [merkle, bulk.obj(BATCH_OPTIONS, write, flush)]
  if (opts.index) {
    indexer = indexStream()
    pipeline.unshift(indexer)
  }
  if (opts.rabin) { // TODO: maybe move this one out?
    pipeline.unshift(rabin())
  }

  var stream = pumpify(pipeline)
  stream.tree = null
  return stream

  function write (datas, cb) {
    var batch = new Array(2 * datas.length)

    for (var i = 0; i < datas.length; i++) {
      var block = datas[i].data
      var index = datas[i].index
      var hash = datas[i].hash
      var external = !!(block && filename && (!indexer || index / 2 >= indexer.blocks))

      batch[2 * i] = {
        type: 'put',
        key: '!by-hash!' + hash.toString('hex'),
        value: messages.TreeNode.encode({
          pointer: pointer,
          index: index,
          external: external ? {filename: filename, start: offset, length: block.length} : null,
          block: external ? null : block
        })
      }

      batch[2 * i + 1] = {
        type: 'put',
        key: '!by-index!' + pointer + '!' + index,
        value: hash
      }

      if (block) {
        blocks++
        offset += block.length
      }
    }

    db.batch(batch, cb)
  }

  function flush (cb) {
    var roots = merkle.roots
    var right = hash.blank

    // TODO: some of these hashes probably need to be persisted ...
    while (roots.length) right = hash.tree(roots.pop().hash, right)

    var tree = {
      pointer: new Buffer(pointer, 'hex'),
      root: right,
      blocks: blocks,
      index: indexer ? indexer.list : []
    }

    var value = messages.TreeInfo.encode(tree)
    if (!tree.index.length && !tree.blocks) done(null)
    else db.put('!trees!' + right.toString('hex'), value, done)

    function done (err) {
      if (err) return cb(err)
      stream.tree = tree
      cb()
    }
  }
}

function indexStream () {
  var pointer = 0
  var length = 0
  var buffer = new Buffer(16384)
  var list = []
  var stream = through.obj(write, flush)
  stream.list = []
  return stream

  function write (data, enc, cb) {
    length += data.length
    buffer.writeUInt16BE(data.length, pointer)
    pointer += 2

    if (pointer === buffer.length) {
      list.push(buffer)
      stream.list.push(length)
      buffer = new Buffer(pointer)
      length = 0
      pointer = 0
    }

    cb(null, data)
  }

  function flush (cb) {
    for (var i = 0; i < list.length; i++) stream.push(list[i])
    if (pointer) {
      stream.list.push(length)
      stream.push(buffer.slice(0, pointer))
    }
    cb()
  }
}