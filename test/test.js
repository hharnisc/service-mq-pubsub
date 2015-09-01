"use strict";

import { expect } from "chai";
import sinon from "sinon";

import { PubSub } from "../src/index";
import { CREATE_CONTEXT, MQ_CONTEXT } from "../src/symbols";

describe("service-pubsub tests", () => {

  function generateTestResources(eventName, subData, pubData) {
    let onStub = sinon.stub();
    onStub.withArgs("ready").yields([]);

    // stub out a subscribe connetion
    let subConnectionStub = sinon.stub();
    subConnectionStub.withArgs(eventName).yields();

    let subOnStub = sinon.stub();
    subOnStub.withArgs("data").yields([JSON.stringify(subData)]);

    // stub out removeAllListener
    let removeAllListenersSubStub = sinon.stub();

    // stub out the PUB connect object
    let pubConnectionStub = sinon.stub();
    pubConnectionStub.withArgs(eventName).yields();

    // stub out the PUB write object
    let pubWriteStub = sinon.stub();
    pubWriteStub.withArgs(JSON.stringify(pubData), "utf8");

    let closeStub = sinon.stub();

    // stub out the socket
    let socketStub = sinon.stub();
    socketStub.withArgs("SUB").returns({
      connect: subConnectionStub,
      on: subOnStub,
      removeAllListeners: removeAllListenersSubStub,
      close: closeStub
    });

    // publish socket
    socketStub.withArgs("PUB").returns({
      connect: pubConnectionStub,
      write: pubWriteStub,
      close: closeStub
    });

    // create rabbit.js context
    let mqContext = {
      on: onStub,
      socket: socketStub
    };

    sinon.stub(PubSub.prototype, CREATE_CONTEXT, () => mqContext);

    let pubsub = new PubSub(eventName, "amqp://somefakeserver");

    return {
      pubsub,
      mqContext,
      onStub,
      subConnectionStub,
      subOnStub,
      pubConnectionStub,
      pubWriteStub,
      socketStub,
      closeStub,
      removeAllListenersSubStub
    };
  }

  afterEach(() => {
    PubSub.prototype[CREATE_CONTEXT].restore();
  });

  it("does have an event name and context", () => {
    let { pubsub } = generateTestResources("event", {}, {});
    expect(pubsub.event).to.equal("event");
    expect(pubsub[MQ_CONTEXT]).to.not.equal(undefined);
    expect(pubsub.connected).to.equal(false);
  });

  it("does connect to publish and subscribe streams", (done) => {
    let {
      pubsub,
      onStub,
      pubConnectionStub,
      subConnectionStub,
      socketStub
    } = generateTestResources("event", {}, {});

    pubsub.connect().then(() => {
      // PUB and SUB sockets should be connected
      expect(socketStub.callCount).to.equal(2);
      expect(pubConnectionStub.callCount).to.equal(1);
      expect(subConnectionStub.callCount).to.equal(1);
      expect(onStub.callCount).to.equal(1);
      expect(pubsub.connected).to.equal(true);
      done();
    }).catch((error) => done(error));
  });

  it("does disconnect from publish and subscribe streams", (done) => {
    let {
      pubsub,
      onStub,
      subConnectionStub,
      pubConnectionStub,
      socketStub,
      closeStub
    } = generateTestResources("event", {}, {});


    // connect -> disconnect
    pubsub.connect().then(() => pubsub.disconnect()).then(() => {
      // PUB and SUB sockets should have been connected once each
      expect(socketStub.callCount).to.equal(2);
      expect(pubConnectionStub.callCount).to.equal(1);
      expect(subConnectionStub.callCount).to.equal(1);
      expect(onStub.callCount).to.equal(1);
      // PUB and SUB sockets should have been disconnected once each
      expect(closeStub.callCount).to.equal(2);
      expect(pubsub.connected).to.equal(false);
      done();
    }).catch((error) => done(error));
  });

  it("does subscribe to events", (done) => {
    let subData = {snakes: "yes"};
    let {
      pubsub,
      onStub,
      subConnectionStub,
      subOnStub,
      pubConnectionStub,
      socketStub
    } = generateTestResources("event", subData, {});


    pubsub.on("data", (data) => {
      // PUB and SUB sockets should have been connected once each
      expect(socketStub.callCount).to.equal(2);
      expect(pubConnectionStub.callCount).to.equal(1);
      expect(subConnectionStub.callCount).to.equal(1);
      expect(onStub.callCount).to.equal(1);
      expect(subOnStub.callCount).to.equal(1);
      expect(subConnectionStub.callCount).to.equal(1);
      expect(pubsub.connected).to.equal(true);
      expect(data).to.eql(subData); // ensure snakes
      done();
    });

    pubsub.connect()
      .then(() => pubsub.subscribe())
      .catch((error) => done(error));
  });

  it("does unsubscribe from events", (done) => {
    let {
      pubsub,
      onStub,
      subConnectionStub,
      subOnStub,
      pubConnectionStub,
      socketStub,
      removeAllListenersSubStub
    } = generateTestResources("event", {}, {});

    pubsub.connect()
      .then(() => pubsub.subscribe())
      .then(() => pubsub.unsubscribe())
      .then(() => {
        // PUB and SUB sockets should have been connected once each
        expect(socketStub.callCount).to.equal(2);
        expect(pubConnectionStub.callCount).to.equal(1);
        expect(subConnectionStub.callCount).to.equal(1);
        expect(onStub.callCount).to.equal(1);
        expect(subOnStub.callCount).to.equal(1);
        expect(subConnectionStub.callCount).to.equal(1);
        expect(removeAllListenersSubStub.callCount).to.equal(1);
        expect(pubsub.connected).to.equal(true);
        done();
      })
      .catch((err) => done(err));
  });

  it("does publish events", (done) => {
    let pubData = {"banana": true};
    let {
      pubsub,
      onStub,
      pubConnectionStub,
      subConnectionStub,
      pubWriteStub,
      socketStub
    } = generateTestResources("event", {}, pubData);

    pubsub.connect()
      .then(() => pubsub.publish(pubData))
      .then(() => {
        // PUB and SUB sockets should be connected
        expect(socketStub.callCount).to.equal(2);
        expect(pubConnectionStub.callCount).to.equal(1);
        expect(subConnectionStub.callCount).to.equal(1);
        expect(onStub.callCount).to.equal(1);
        expect(pubWriteStub.callCount).to.equal(1);
        expect(pubsub.connected).to.equal(true);
        done();
      })
      .catch((error) => done(error));
  });
});
