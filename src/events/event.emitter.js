import EventEmitter from "node:events";

const eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(20);

export default eventEmitter;