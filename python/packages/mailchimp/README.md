# matimo-mailchimp

Matimo provider package for **mailchimp**. Bundles YAML tool definitions that plug into the [Matimo SDK](https://pypi.org/project/matimo/).

## Installation

```bash
pip install matimo matimo-mailchimp
```

## Usage

```python
from matimo import Matimo
from matimo_mailchimp import get_tools_path

matimo = await Matimo.init(get_tools_path())
```
