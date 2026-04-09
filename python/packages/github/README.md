# matimo-github

Matimo provider package for **github**. Bundles YAML tool definitions that plug into the [Matimo SDK](https://pypi.org/project/matimo/).

## Installation

```bash
pip install matimo matimo-github
```

## Usage

```python
from matimo import Matimo
from matimo_github import get_tools_path

matimo = await Matimo.init(get_tools_path())
```
