# Mastro example with server-sent events (SSE)

See [HTTP streaming in the guide](https://mastrojs.github.io/guide/caching-service-workers-streaming/#http-streaming).

This is using the browser's [EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) to consume the SSE stream on the client. For a client that returns an [AsyncIterable](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols), use the tiny [fetch-event-stream library](https://github.com/lukeed/fetch-event-stream).
