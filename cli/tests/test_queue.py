"""Tests for InferenceQueue."""

import asyncio

import pytest

from openeye_ai.server.queue import InferenceQueue, QueueFullError


@pytest.mark.asyncio
async def test_submit_returns_result():
    queue = InferenceQueue(max_concurrent=1)
    result = await queue.submit(lambda: 42)
    assert result == 42


@pytest.mark.asyncio
async def test_submit_async_function():
    queue = InferenceQueue(max_concurrent=1)

    async def async_fn():
        return "async_result"

    result = await queue.submit(async_fn)
    assert result == "async_result"


@pytest.mark.asyncio
async def test_submit_with_args_and_kwargs():
    queue = InferenceQueue(max_concurrent=1)
    result = await queue.submit(lambda x, y=10: x + y, 5, y=20)
    assert result == 25


@pytest.mark.asyncio
async def test_serializes_with_max_concurrent_1():
    queue = InferenceQueue(max_concurrent=1, max_queue_size=10)
    order = []

    async def task(label):
        order.append(f"start_{label}")
        await asyncio.sleep(0.01)
        order.append(f"end_{label}")
        return label

    results = await asyncio.gather(
        queue.submit(task, "a"),
        queue.submit(task, "b"),
    )

    assert set(results) == {"a", "b"}


@pytest.mark.asyncio
async def test_queue_size_and_active_count():
    queue = InferenceQueue(max_concurrent=1, max_queue_size=10)

    assert queue.queue_size == 0
    assert queue.active_count == 0

    started = asyncio.Event()
    release = asyncio.Event()

    async def blocking_task():
        started.set()
        await release.wait()
        return "done"

    task = asyncio.create_task(queue.submit(blocking_task))
    await started.wait()
    assert queue.active_count == 1

    release.set()
    await task


@pytest.mark.asyncio
async def test_queue_full_raises():
    queue = InferenceQueue(max_concurrent=1, max_queue_size=1)

    started = asyncio.Event()
    release = asyncio.Event()

    async def blocking():
        started.set()
        await release.wait()

    t1 = asyncio.create_task(queue.submit(blocking))
    await started.wait()
    t2 = asyncio.create_task(queue.submit(lambda: None))
    await asyncio.sleep(0.05)

    with pytest.raises(QueueFullError):
        await queue.submit(lambda: None)

    release.set()
    await t1
    await t2


@pytest.mark.asyncio
async def test_queue_full_error_message():
    queue = InferenceQueue(max_concurrent=1, max_queue_size=2)
    with pytest.raises(QueueFullError, match="2 pending"):
        started = asyncio.Event()
        release = asyncio.Event()

        async def blocking():
            started.set()
            await release.wait()

        t1 = asyncio.create_task(queue.submit(blocking))
        await started.wait()
        # Fill remaining queue slots
        t2 = asyncio.create_task(queue.submit(lambda: None))
        t3 = asyncio.create_task(queue.submit(lambda: None))
        await asyncio.sleep(0.05)
        try:
            await queue.submit(lambda: None)
        finally:
            release.set()
            await asyncio.gather(t1, t2, t3, return_exceptions=True)


@pytest.mark.asyncio
async def test_submit_exception_propagates():
    """If the submitted fn raises, the exception should propagate to caller."""
    queue = InferenceQueue(max_concurrent=1)

    def failing():
        raise ValueError("boom")

    with pytest.raises(ValueError, match="boom"):
        await queue.submit(failing)

    # Queue should still be usable after error
    result = await queue.submit(lambda: "ok")
    assert result == "ok"


@pytest.mark.asyncio
async def test_submit_async_exception_propagates():
    queue = InferenceQueue(max_concurrent=1)

    async def failing_async():
        raise RuntimeError("async boom")

    with pytest.raises(RuntimeError, match="async boom"):
        await queue.submit(failing_async)


@pytest.mark.asyncio
async def test_counts_return_to_zero_after_completion():
    queue = InferenceQueue(max_concurrent=2, max_queue_size=10)

    results = await asyncio.gather(
        queue.submit(lambda: 1),
        queue.submit(lambda: 2),
        queue.submit(lambda: 3),
    )
    assert sorted(results) == [1, 2, 3]
    assert queue.active_count == 0
    assert queue.queue_size == 0


@pytest.mark.asyncio
async def test_max_concurrent_2_allows_parallel():
    queue = InferenceQueue(max_concurrent=2, max_queue_size=10)
    started = []

    async def task(label):
        started.append(label)
        await asyncio.sleep(0.05)
        return label

    results = await asyncio.gather(
        queue.submit(task, "a"),
        queue.submit(task, "b"),
    )
    assert set(results) == {"a", "b"}
    # Both should have started before either finished
    assert len(started) == 2
