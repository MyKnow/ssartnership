import importlib.util
import sys

spec = importlib.util.spec_from_file_location('host_metrics', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

# Guest CPU time is already included in user/nice and must not be counted twice.
before = 'cpu 100 20 30 400 50 0 0 0 90 10\ncpu0 0 0 0 0\n'
after = 'cpu 140 20 40 430 70 0 0 0 130 10\n'
assert module.cpu_busy_ratio(before, after) == 0.5
assert module.memory_available_bytes('MemFree: 8 kB\nMemAvailable: 128 kB\n') == 131072
for args in [(after, before), (before, before), ('cpu 1 2\n', after)]:
    try:
        module.cpu_busy_ratio(*args)
        raise AssertionError('invalid CPU observation accepted')
    except ValueError:
        pass
try:
    module.memory_available_bytes('MemFree: 8 kB\n')
    raise AssertionError('free memory substituted for available memory')
except ValueError:
    pass
