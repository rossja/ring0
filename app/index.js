// set up variables
const PORT = 9001
const MULTICAST_ADDR = '239.255.0.255'

// import required libs
const dgram = require('dgram')
const host = process.env.RING0_ROLE

// this is just here to document what the JSON data should look like
/**
 * @namespace
 * @property {object}   messageData        - json data object
 * @property {string}   messageData.sender - the host that sent the data
 * @property {string}   messageData.op     - the operation being performed [rh-tell, rh-switch, rh-query]
 * @property {string}   messageData.rh     - the host that is the current ring-holder (optional unless jsonData.op == 'rh-tell')
 * @property {int}      messageData.ts     - the unix timestamp of when the request was sent
 *
 * const exampleMessage = {
 *   messageData: {
 *     sender: 'frodo',
 *     op: 'rh-tell',
 *     rh: 'frodo',
 *     ts: 1542154982
 *   }
 * }
 */

/*
 * ======================================================
 *                 NON-MESSAGE FUNCTIONS
 * ======================================================
 */

/**
 * finds out who the current ring-holder is
 */
let getRingholder = () => {
  return new Promise((resolve, reject) => {
    // this should query something like redis or etcd
    // for the value stored there
    const members = [
      'frodo',
      'gotham',
      'springfield',
      'metropolis'
    ]
    var randMember = members[Math.floor(Math.random() * members.length)]
    if (randMember) {
      resolve(randMember)
    } else {
      reject(Error('no ring-holder found'))
    }
  })
}

/**
 * returns the timestamp in seconds since epoch (eg. unix timestamp)
 */
let ts = () => {
  return Math.floor(Date.now() / 1000)
}

/*
 * ======================================================
 *               OUTBOUND MESSAGE HANDLERS
 * ======================================================
 */

/**
 * OP: rh-tell - tells the network who the ring-holder is
 * @param {object} socket - the socket to write to
 */
function sendRingholderAnnouncement (socket) {
  getRingholder()
    .then(function (ringholder) {
      const msgData = JSON.stringify({
        sender: host,
        op: 'rh-tell',
        rh: ringholder,
        ts: ts()
      })
      const message = Buffer.from(msgData)
      socket.send(message, 0, message.length, PORT, MULTICAST_ADDR, function () {
        console.info(`${host} SENDING: '${msgData}'`)
      })
    })
    .catch(function (error) {
      console.error(`ring-holder not found: ${error}`)
    })
}

/**
 * OP: rh-query - asks the network who the ring-holder is
 * @param {object} socket - the socket to write to
 */
function sendRingholderQuery (socket) {
  const msgData = JSON.stringify({
    sender: host,
    op: 'rh-query',
    ts: ts()
  })
  const message = Buffer.from(msgData)
  socket.send(message, 0, message.length, PORT, MULTICAST_ADDR, function () {
    console.info(`${host} SENDING: '${msgData}'`)
  })
}

/**
 * OP: rh-switch - assigns a new ring-holder
 * @param {object} socket     - socket object to write to
 */
function acceptToken (socket) {
  const msgData = JSON.stringify({
    sender: host,
    op: 'rh-switch',
    rh: host,
    ts: ts()
  })
  const message = Buffer.from(msgData)
  socket.send(message, 0, message.length, PORT, MULTICAST_ADDR, function () {
    console.info(`${host} SENDING: '${msgData}'`)
  })
}

/*
 * ======================================================
 *                INBOUND MESSAGE HANDLERS
 * ======================================================
 */

/**
 * this parses the incoming messages on frodo
 * @param {object} message  - the inbound message data
 * @param {object} socket   - the socket to write to
 */
function frodoMessageHandler (message, socket) {
  const data = JSON.parse(message)
  switch (data.op) {
    case 'rhq':
      getRingholder()
        .then(function (ringholder) {
          sendRingholderAnnouncement(socket)
        })
        .catch(function (error) {
          console.error(`ringholder not found: ${error}`)
        })
      break
    default:
      console.info(`${host} RECEIVED: ${message}`)
  }
}

/**
 * this parses the incoming messages on branch hosts
 * @param {object} message  - the inbound message data
 * @param {object} socket   - the socket to write to
 */
function branchMessageHandler (message, socket) {
  const data = JSON.parse(message)
  switch (data.op) {
    case 'rha':
      if (data.rh === host) {
        // the new ring-holder is this host, send a token accept message
        acceptToken(socket)
      }
      break
    default:
      console.info(`${host} RECEIVED: ${message}`)
  }
}

/*
 * ======================================================
 *                      MAIN SCREEN TURN ON
 * ======================================================
 */

/**
 * sets up the multicast token ring
 */
function main () {
  // socket setup
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  socket.bind(PORT)
  socket.on('listening', function () {
    socket.addMembership(MULTICAST_ADDR)

    // START SENDING MESSAGES
    if (host === 'frodo') {
      // this is frodo, send ring-holder announcements
      sendRingholderAnnouncement(socket)
      setInterval(function () {
        sendRingholderAnnouncement(socket)
      }, 10000)
    } else {
      // this is a branch, send ring-holder queries
      sendRingholderQuery(socket)
      setInterval(function () {
        sendRingholderQuery(socket)
      }, 10000)
    }

    // spit some basic info to the console
    const address = socket.address()
    console.log(`ring0 socket listening on ${host}:${address.port}`)
  })

  // handle incoming messages
  socket.on('message', function (message) {
    if (host === 'frodo') {
      frodoMessageHandler(message, socket)
    } else {
      branchMessageHandler(message, socket)
    }
  })
}

// call the main function
main()
