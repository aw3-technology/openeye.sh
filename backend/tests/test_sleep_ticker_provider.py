"""Tests for SleepTickerProvider."""

import asyncio

import pytest


def test_default_skip_sleep_is_false(sleep_ticker):
    assert sleep_ticker.skip_sleep is False


def test_set_skip_sleep(sleep_ticker):
    sleep_ticker.skip_sleep = True
    assert sleep_ticker.skip_sleep is True


@pytest.mark.asyncio(loop_scope="function")
async def test_sleep_returns_immediately_when_skipped(sleep_ticker):
    sleep_ticker.skip_sleep = True
    start = asyncio.get_event_loop().time()
    await sleep_ticker.sleep(10.0)
    elapsed = asyncio.get_event_loop().time() - start
    assert elapsed < 1.0


@pytest.mark.asyncio(loop_scope="function")
async def test_sleep_waits_for_duration(sleep_ticker):
    start = asyncio.get_event_loop().time()
    await sleep_ticker.sleep(0.1)
    elapsed = asyncio.get_event_loop().time() - start
    assert elapsed >= 0.05  # Allow some tolerance


# ── Edge cases ──────────────────────────────────────────────────────


@pytest.mark.asyncio(loop_scope="function")
async def test_sleep_zero_duration(sleep_ticker):
    """Sleep with zero duration returns immediately."""
    start = asyncio.get_event_loop().time()
    await sleep_ticker.sleep(0.0)
    elapsed = asyncio.get_event_loop().time() - start
    assert elapsed < 0.5


@pytest.mark.asyncio(loop_scope="function")
async def test_skip_sleep_cancels_active_sleep(sleep_ticker):
    """Setting skip_sleep=True while sleeping cancels the sleep."""

    async def do_sleep():
        await sleep_ticker.sleep(10.0)

    task = asyncio.create_task(do_sleep())
    await asyncio.sleep(0.05)  # Let sleep start
    sleep_ticker.skip_sleep = True
    # The task should finish quickly after cancellation
    await asyncio.wait_for(task, timeout=2.0)


@pytest.mark.asyncio(loop_scope="function")
async def test_sleep_clears_current_task_after_completion(sleep_ticker):
    """After sleep completes, _current_sleep_task is None."""
    await sleep_ticker.sleep(0.01)
    assert sleep_ticker._current_sleep_task is None


@pytest.mark.asyncio(loop_scope="function")
async def test_skip_sleep_toggle(sleep_ticker):
    """Can toggle skip_sleep back to False."""
    sleep_ticker.skip_sleep = True
    sleep_ticker.skip_sleep = False
    assert sleep_ticker.skip_sleep is False

    # Sleep should now wait again
    start = asyncio.get_event_loop().time()
    await sleep_ticker.sleep(0.05)
    elapsed = asyncio.get_event_loop().time() - start
    assert elapsed >= 0.03


@pytest.mark.asyncio(loop_scope="function")
async def test_multiple_sequential_sleeps(sleep_ticker):
    """Multiple sequential sleeps all complete."""
    for _ in range(3):
        await sleep_ticker.sleep(0.01)
    assert sleep_ticker._current_sleep_task is None
