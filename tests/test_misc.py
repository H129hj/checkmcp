from checkmcp.badge import badge_svg
from checkmcp.cli import _slug as cli_slug


def test_badge_is_svg_with_score():
    svg = badge_svg(87, "B")
    assert svg.lstrip().startswith("<svg") and "87" in svg


def test_cli_slug_from_url():
    assert cli_slug("https://mcp.deepwiki.com/mcp") == "mcp-deepwiki-com"
    assert cli_slug("https://Example.COM/x") == "example-com"
