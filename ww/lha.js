// Adapted from lhasa by Simon Howard <https://fragglet.github.io/lhasa/>

function BitStreamReader(callback) {
  this.callback = callback;
}
BitStreamReader.prototype = {
  callback: null, // callback(byte array) -> number of bytes written
	bit_buffer: 0, // int32
	bits: 0,
	
  // Return the next n bits waiting to be read from the input stream,
  // without removing any.  Returns -1 for failure.
	peek: function(n) {
  	if (n === 0) return 0;

  	// If there are not enough bits in the buffer to satisfy this
  	// request, we need to fill up the buffer with more bits.
  	while (this.bits < n) {
  		// Maximum number of bytes we can fill?
  		var fill_bytes = (32 - this.bits) / 8;
  		// Read from input and fill bit_buffer.
  	  var buf = new Uint8Array(4);
  		var bytes = this.callback(buf);
  
  		// End of file?
  		if (bytes < 4) return -1;

  		this.bit_buffer |= buf[0] << (24 - this.bits);
  		this.bit_buffer |= buf[1] << (16 - this.bits);
  		this.bit_buffer |= buf[2] << (8 - this.bits);
  		this.bit_buffer |= buf[3];
  
  		this.bits += bytes * 8;
  	}
  
  	return this.bit_buffer >> (32 - n);
	},
  // Read bit(s) from the input stream.
  // Returns -1 for failure.
  read_bits: function(n) {
  	var result = this.peek_bits(n);
  	if (result >= 0) {
  		this.bit_buffer <<= n;
  		this.bits -= n;
  	}
  	return result;
  },
  // Read a bit from the input stream.
  // Returns -1 for failure.
  read_bit: function() {
  	return this.read_bits(1);
  },
  // Read bits from the input stream, traversing the specified tree
  // from the root node until we reach a leaf.  The leaf value is
  // returned.
  read_from_tree: function(tree) {
  	// Start from root.
  	var code = tree[0];
  	while ((code & tree.leaf) === 0) {
  		var bit = this.read_bit();
  		if (bit < 0) return -1;
  		code = tree[code + bit];
  	}
  	// Mask off leaf bit to get the plain code.
  	return code & ~tree.leaf;
  },
};

// tree
function makeTree(elementBits, length) {
  var tree;
  switch(elementBits) {
    case 8: tree = new Uint8Array(length); break;
    case 16: tree = new Uint16Array(length); break;
    case 32: tree = new Uint32Array(length); break;
    default: throw new Error('unsupported number of bits: ' + bits);
  }
  tree.bits = elementBits;
  tree.leaf = 1 << (elementBits*8 - 1);
  for (var i = 0; i < tree.length; i++) {
    tree[i] = tree.leaf;
  }
  tree.set_single = function(code) {
    this[0] = code | this.leaf;
  };
  // "Expand" the list of queue entries. This generates a new child
  // node at each of the entries currently in the queue, adding the
  // children of those nodes into the queue to replace them.
  // The effect of this is to add an extra level to the tree, and
  // to increase the tree depth of the indices in the queue.
  tree.expand_queue = function() {
  	// check there's enough room for the new nodes
  	var new_nodes = (this.tree_allocated - this.next_entry) * 2;
  	if (this.tree_allocated + new_nodes > this.length) {
  		return;
  	}
  	// Go through all entries currently in the allocated range, and
  	// allocate a subnode for each.
  	var end_offset = this.tree_allocated;
  	while (this.next_entry < end_offset) {
  		this[this.next_entry++] = this.tree_allocated;
  		this.tree_allocated += 2;
  	}
  };
  tree.read_next_entry = function() {
  	// Sanity check.
  	if (this.next_entry >= this.tree_allocated) {
  		return 0;
  	}
    return this.next_entry++;
  };
  tree.add_codes_with_length = function(code_lengths, code_len) {
  	var codes_remaining = false;
  	for (var i = 0; i < code_lengths.length; i++) {
  		// Does this code belong at this depth in the tree?
  		if (code_lengths[i] === code_len) {
  			var node = this.read_next_entry();
  			this[node] = i | this.leaf;
  		}
  		// More work to be done after this pass?
  		else if (code_lengths[i] > code_len) {
  			codes_remaining = true;
  		}
  	}
  	return codes_remaining;
  };
  tree.build = function(code_lengths) {
  	// Start with a single entry in the queue - the root node
  	// pointer.
  	this.next_entry = 0;
  
  	// We always have the root ...
  	this.allocated = 1;
  
  	// Iterate over each possible code length.
  	// Note: code_len == 0 is deliberately skipped over, as 0
  	// indicates "not used".
  	var code_len = 0;
  	do {
  		// Advance to the next code length by allocating extra
  		// nodes to the tree - the slots waiting in the queue
  		// will now be one level deeper in the tree (and the
  		// codes 1 bit longer).
  		this.expand_queue();
  		code_len++;
  		// Add all codes that have this length.
  	} while (this.add_codes_with_length(code_lengths, code_len));
  };
}

// new decoder

var COPY_THRESHOLD = 3; // bytes

// Number of different command codes. 0-255 range are literal byte
// values, while higher values indicate copy from history.
var NUM_CODES = 510;

// Number of possible codes in the "temporary table" used to encode the
// codes table.
var MAX_TEMP_CODES = 20;

function LHANewDecoder(historyBits, callback) {
  this.HISTORY_BITS = historyBits;
  // Required size of the output buffer.  At most, a single call to read()
  // might result in a copy of the entire ring buffer.
  this.RING_BUFFER_SIZE = 1 << historyBits;
  this.OUTPUT_BUFFER_SIZE = 1 << historyBits;
  
  this.ringbuf = new Uint8Array(1 << historyBits);
  for (var i = 0; i < this.ringbuf.length; i++) {
    this.ringbuf[i] = 0x20;
  }

	this.code_tree = makeTree(16, NUM_CODES * 2);
	this.offset_tree = makeTree(16, MAX_TEMP_CODES * 2);

  this.bit_stream_reader = new BitStreamReader(callback);
}
LHANewDecoder.prototype = {
  bit_stream_reader: null, // Input bit stream.
  HISTORY_BITS: NaN,
  RING_BUFFER_SIZE: NaN,
  OUTPUT_BUFFER_SIZE: NaN,
  ringbuf: null, // ring buffer of past data, for position-based copies
	ringbuf_pos: 0,
	block_remaining: 0, // # commands remaining before we start a new block
	code_tree: null,
	offset_tree: null,
	
  // read a length value - this is normally a value in the 0-7 range, but
  // sometimes can be longer
  read_length_value: function() {
  	var len = this.bit_stream_reader.read_bits(3);
  	if (len < 0) return -1;
  	if (len === 7) {
  		// read more bits to extend the length, until we hit a zero
  		for (var i = this.bit_stream_reader.read_bit(); i !== 0; i = this.bit_stream_reader.read_bit()) {
  			if (i < 0) return -1;
  			len++;
  		}
  	}
  	return len;
  },
  // read the values from the input stream that define the temporary table
  // used for encoding the code table
  read_temp_table: funtion() {
  	var n = this.bit_stream_reader.read_bits(5); // number of codes
  	if (n < 0) return 0;
  	if (n === 0) {
    	// special case: a single code, of zero length
  		var code = this.bit_stream_reader.read_bits(5);
  		if (code < 0) return 0;
  		this.offset_tree.set_single(code);
  		return 1;
  	}
  	// Enforce a hard limit on the number of codes.
  	var code_lengths = new Uint8Array(Math.min(MAX_TEMP_CODES, n));
  	// Read the length of each code.
  	for (var i = 0; i < code_lengths.length; i++) {
  		var len = this.read_length_value();
  		if (len < 0) return 0;
  		code_lengths[i] = len;
  		// After the first three lengths, there is a 2-bit
  		// field to allow skipping over up to a further three
  		// lengths. Not sure of the reason for this ...
  		if (i == 2) {
  			len = this.bit_stream_reader.read_bits(2);
  			if (len < 0) return 0;
  			for (var j = 0; j < len; j++) {
  				i++;
  				code_lengths[i] = 0;
  			}
  		}
  	}
  	this.offset_tree.build(code_lengths);
  	return 1;
  },
  // Code table codes can indicate that a sequence of codes should be
  // skipped over. The number to skip is Huffman-encoded. Given a skip
  // range (0-2), this reads the number of codes to skip over.
  read_skip_count: function(skiprange) {
  	if (skiprange === 0) return 1; // skiprange=0 => 1 code
  	else if (skiprange == 1) {
    	// skiprange=1 => 3-18 codes.
  		var result = this.bit_stream_reader.read_bits(4);
  		if (result < 0) return -1;
  		return result + 3;
  	}
  	else {
    	// skiprange=2 => 20+ codes.
  		var result = this.bit_stream_reader.read_bits(9);
  		if (result < 0) return -1;
  		return result + 20;
  	}
  },
  read_code_table: function() {
  	// How many codes?
  	var n = this.bit_stream_reader.read_bits(9);
  	if (n < 0) return false;

  	if (n === 0) {
    	// n=0 implies a single code of zero length; all inputs
    	// decode to the same code.
  		var code = this.bit_stream_reader.read_bits(9);
  		if (code < 0) return false;
  		this.code_tree.set_single(code);
  		return true;
  	}
  
  	if (n > NUM_CODES) n = NUM_CODES;

  	var code_lengths = new Uint8Array(n);
  
  	// Read the length of each code.
  	// The lengths are encoded using the temp-table previously read;
  	// offset_tree is reused temporarily to hold it.
  
  	var i = 0;
  
  	while (i < n) {
  		var code = this.bit_stream_reader.read_from_tree(this.offset_tree);
  
  		if (code < 0) return false;

  		// The code that was read can have different meanings.
  		// If in the range 0-2, it indicates that a number of
  		// codes are unused and should be skipped over.
  		// Values greater than two represent a frequency count.
  
  		if (code <= 2) {
  			var skip_count = this.read_skip_count(code);
  			if (skip_count < 0) return false;
  			for (var j = 0; j < skip_count && i < n; j++) {
  				code_lengths[i] = 0;
  				i++;
  			}
  		}
  		else {
  			code_lengths[i] = code - 2;
  			i++;
  		}
  	}
  	this.code_tree.build(code_lengths);
  	return true;
  },
  read_offset_table: function() {
  	// How many codes?
  	var n = this.bit_stream_reader.read_bits(OFFSET_BITS);
  	if (n < 0) return false;
  	if (n === 0) {
    	// special case: a single code, of zero length
  		var code = this.bit_stream_reader.read_bits(OFFSET_BITS);
  		if (code < 0) return false;
  		this.offset_tree.set_single(code);
  		return true;
  	}
  	var code_lengths = new Uint8Array(Math.min(this.HISTORY_BITS, n));
  	// Read the length of each code.
  	for (var i = 0; i < code_lengths.length; i++) {
  		var len = this.read_length_value();
  		if (len < 0) return false;
  		code_lengths[i] = len;
  	}
  	this.offset_tree.build(code_lengths);
  	return true;
  },
  // Start reading a new block from the input stream.
  start_new_block: function() {
  	var len = this.bit_stream_reader.read_bits(16); // length of the block, in commands
  	if (len < 0) return false;
  	this.block_remaining = len;
  	return this.read_temp_table() && read_code_table(decoder) && read_offset_table(decoder);
  },
  // Read the next code from the input stream. Returns the code, or -1 if
  // an error occurred.
  read_code: function() {
  	return this.bit_stream_reader.read_from_tree(this.code_tree);
  },
  // Read an offset distance from the input stream.
  // Returns the code, or -1 if an error occurred.
  read_offset_code: function() {
  	var bits = this.bit_stream_reader.read_from_tree(this.offset_tree);
  	if (bits < 0) return -1;
  	// The code read indicates the length of the offset in bits.
  	//
  	// The returned value looks like this:
  	//   bits = 0  ->         0
  	//   bits = 1  ->         1
  	//   bits = 2  ->        1x
  	//   bits = 3  ->       1xx
  	//   bits = 4  ->      1xxx
  	//             etc.
  	if (bits == 0) return 0;
  	if (bits == 1) return 1;
		var result = this.bit_stream_reader.read_bits(bits - 1);
		if (result < 0) return -1;
		return result + (1 << (bits - 1));
  },
  // Add a byte value to the output stream.
  output_byte: function(out_buf, out_pos, b) {
    out_buf[out_pos] = b;
  	this.ringbuf[this.ringbuf_pos] = b;
  	this.ringbuf_pos = (this.ringbuf_pos + 1) % this.ringbuf.length;
  	return buf_len + 1;
  },
  // Copy a block from the history buffer.
  copy_from_history: function(out_buf, out_pos, count) {
  	var offset = this.read_offset_code();
  	if (offset < 0) return;
  	var start = this.ringbuf_pos + this.ringbuf.length - offset - 1;
  	for (var i = 0; i < count; i++) {
  		out_pos = this.output_byte(out_buf, out_pos, this.ringbuf[(start + i) % this.ringbuf.length]);
  	}
  	return out_pos;
  },
  read: function(out_buf, out_pos) {
  	// Start of new block?
  	while (this.block_remaining === 0) {
  		if (!this.start_new_block()) return -1;
  	}
  	this.block_remaining--;
  	// Read next command from input stream.
  	var code = this.read_code(decoder);
  	if (code < 0) return -1;
  	var result = 0;
  	if (code < 256) {
  		out_pos = this.output_byte(out_buf, out_pos, code);
  	}
  	else {
  		out_pos = this.copy_from_history(out_buf, out_pos, code - 256 + COPY_THRESHOLD);
  	}
  	return out_pos;
  },
};
