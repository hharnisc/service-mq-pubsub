import { EventEmitter } from "events";
import { createContext } from "rabbit.js";
import { CREATE_CONTEXT, MQ_CONTEXT } from "./symbols";

// A thin wrapper around rabbit.js to handle publish
// and subscribe functionality. All subscribed clients
// get every published message.
export class PubSub extends EventEmitter {
  constructor(event, url) {
    super();
    this[MQ_CONTEXT] = this[CREATE_CONTEXT](url);
    this.event = event;
    this.connected = false;
    this.pubSocket = null;
    this.subSocket = null;
  }

  [CREATE_CONTEXT] (url) {
    return createContext(url);
  }

  connect () {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve();
      } else {
        this[MQ_CONTEXT].on("ready", () => {
          this.connected = true;
          this.pubSocket = this[MQ_CONTEXT].socket("PUB");
          this.subSocket = this[MQ_CONTEXT].socket("SUB");

          let pubPromise = new Promise((pubResolve) => {
            this.pubSocket.connect(this.event, () => pubResolve());
          });
          let subPromise = new Promise((subResolve) => {
            this.subSocket.connect(this.event, () => subResolve());
          });

          // wait for both publish and subscribe connections
          Promise.all([pubPromise, subPromise]).then(() => {
            this.connected = true;
            resolve();
          });
        });
      }
    });
  }

  disconnect () {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject();
      } else {
        this.pubSocket.close();
        this.subSocket.close();
        this.connected = false;
        resolve();
      }
    });
  }

  subscribe () {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject();
      } else {
        this.subSocket.on("data", (data) => {
          this.emit("data", JSON.parse(data));
        });
        resolve();
      }
    });
  }

  unsubscribe () {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject();
      } else {
        this.subSocket.removeAllListeners("data");
        resolve();
      }
    });
  }

  publish (data) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject();
      } else {
        this.pubSocket.write(JSON.stringify(data), "utf8");
        resolve();
      }
    });
  }
}
