# THANK YOU: https://github.com/duskmoon314/typst-fontawesome/blob/main/helper.py

import json
import urllib.request

VERSION = "6.6.0"
API_URL = "https://api.fontawesome.com"
QUERY = f"""
query {{
    release (version: "{VERSION}") {{
        icons {{
            id,
            unicode,
            familyStylesByLicense {{
                free {{ style }},
            }},
            aliases {{ names }}
        }}
    }}
}}
"""

FONTAWESOME_TEMPLATE = """
export type FontAwesomeIcon = {ICONLIST}

const FontAwesome = ({
  kind,
  icon,
  props,
}: {
  kind?: "solid" | "brand"
  icon: FontAwesomeIcon
  props?: React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLElement>,
    HTMLElement
  >
}) => {
  kind = kind ?? "solid"

  return <i className={`fa-${kind} fa-${icon}`} {...props} />
}

export default FontAwesome
""".strip()

if __name__ == "__main__":
    request = urllib.request.Request(
        API_URL,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
        data=json.dumps({"query": QUERY}).encode("utf-8"),
    )

    with urllib.request.urlopen(request) as response:
        data = json.load(response)

    print(
        FONTAWESOME_TEMPLATE.replace(
            "{ICONLIST}",
            " | ".join(
                ['"' + icon["id"] + '"' for icon in data["data"]["release"]["icons"]]
            ),
        )
    )
