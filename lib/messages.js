var protobuf = require('protocol-buffers')

module.exports = protobuf(`
  message Link {
    optional bytes pointer = 4;
    required bytes id = 1;
    required uint64 blocks = 2;
    repeated uint64 index = 3;
  }

  message File {
    required string name = 1;
    required uint32 mode = 2;
    optional uint64 size = 3;
    optional uint32 uid = 4;
    optional uint32 gid = 5;
    optional uint64 mtime = 6;
    optional uint64 ctime = 7;
  }

  message Entry {
    optional string type = 1;
    required bytes value = 2;
    optional Link link = 3;
  }

  message Handshake {
    required string protocol = 1;
    optional uint64 version = 2;
  }

  message Join {
    required uint64 channel = 1;
    required bytes link = 2;
  }

  message Leave {
    required uint64 channel = 1;
  }

  message Choke {
    required uint64 channel = 1;
  }

  message Unchoke {
    required uint64 channel = 1;
    optional bytes bitfield = 2;
  }

  message Request {
    required uint64 channel = 1;
    required uint64 block = 2;
  }

  message Response {
    message Node {
      required uint64 index = 1;
      required bytes hash = 2;
    }

    required uint64 channel = 1;
    required uint64 block = 2;
    required bytes data = 3;
    repeated Node proof = 4;
  }

  message Have {
    required uint64 channel = 1;
    repeated uint64 blocks = 2;
    optional bytes bitfield = 3;
  }
`)
