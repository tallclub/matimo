# matimo

> The `matimo` package is a meta-distribution that installs [`matimo-core`](https://pypi.org/project/matimo-core/) — the full SDK is provided there.

```bash
pip install matimo
```

Then:

```python
from matimo import Matimo

matimo = await Matimo.init('./tools')
result = await matimo.execute('my_tool', {'param': 'value'})
```

See [matimo.dev/docs](https://matimo.dev/docs) for full documentation.
