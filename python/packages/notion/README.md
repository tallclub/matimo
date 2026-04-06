# matimo-notion

Matimo provider package for **notion**. Bundles YAML tool definitions that plug into the [Matimo SDK](https://pypi.org/project/matimo/).

## Installation

```bash
pip install matimo matimo-notion
```

## Usage

```python
from matimo import Matimo
from matimo_notion import get_tools_path

matimo = await Matimo.init(get_tools_path())
```
