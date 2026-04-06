# matimo-twilio

Matimo provider package for **twilio**. Bundles YAML tool definitions that plug into the [Matimo SDK](https://pypi.org/project/matimo/).

## Installation

```bash
pip install matimo matimo-twilio
```

## Usage

```python
from matimo import Matimo
from matimo_twilio import get_tools_path

matimo = await Matimo.init(get_tools_path())
```
