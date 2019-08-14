# ring0

## overview

this is a proof-of-concept ridiculous "token ring" style
communication protocol implemented in node.js and using
multicast.

it makes no sense and is definitely not something that
should ever be used in a real network.

## specification

**nodes**

nodes are assigned roles through the `RING0_ROLE` env var:

* **frodo**: the ring-bearer, frodo is responsible for tracking and assigning the ring-holder
* **anything else**: all other nodes can be named any valid hostname string

**ring-holder**

* any node joined to the multicast network can be a ring-holder
* as the ring-bearer, frodo is the default ring-holder
* frodo is responsible for tracking who the current ring-holder is at all times
* all other nodes query frodo at a regular interval to find out who the current ring-holder is
* any node can also query frodo to request permission to become the ring-holder

