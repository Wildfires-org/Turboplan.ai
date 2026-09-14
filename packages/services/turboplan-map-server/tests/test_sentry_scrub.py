from app.main import _redact_sensitive_url, _scrub_sentry_event


def test_redacts_sensitive_params_keeps_rest():
    assert (
        _redact_sensitive_url("/welcome?token=abc&X-Amz-Signature=sig&code=SEC&next=/x")
        == "/welcome?token=[redacted]&X-Amz-Signature=[redacted]&code=[redacted]&next=/x"
    )


def test_matches_word_anywhere_in_param_name():
    assert (
        _redact_sensitive_url("https://r2.example.com/f?X-Amz-Security-Token=t&filter=a")
        == "https://r2.example.com/f?X-Amz-Security-Token=[redacted]&filter=a"
    )


def test_redacts_email_param():
    assert (
        _redact_sensitive_url("/check-email?email=user%40example.com&type=login")
        == "/check-email?email=[redacted]&type=login"
    )


def test_untouched_without_sensitive_params():
    url = "https://app.example.com/projects?page=2&sort=name"
    assert _redact_sensitive_url(url) == url


def test_scrub_event_strips_headers_cookies_and_redacts_urls():
    event = {
        "request": {
            "url": "https://app.example.com/magic?token=abc",
            "query_string": "token=abc&a=1",
            "cookies": "sid=1",
            "data": {"magicLinkUrl": "https://app/verify?token=abc"},
            "headers": {
                "Authorization": "Bearer secret",
                "Cookie": "sid=1",
                "X-Api-Key": "k",
                "Accept": "application/json",
            },
        },
        "breadcrumbs": {
            "values": [
                {"data": {"url": "https://x.example.com/cb?secret=s&ok=1"}},
                {"data": {"http.query": "X-Amz-Signature=sig&ok=1"}},
            ]
        },
        "exception": {
            "values": [
                {"value": "403 Client Error for url: https://r2/f?X-Amz-Signature=sig"}
            ]
        },
    }

    scrubbed = _scrub_sentry_event(event, None)

    assert "cookies" not in scrubbed["request"]
    assert "data" not in scrubbed["request"]
    assert scrubbed["request"]["headers"] == {"Accept": "application/json"}
    assert scrubbed["request"]["url"] == "https://app.example.com/magic?token=[redacted]"
    assert scrubbed["request"]["query_string"] == "token=[redacted]&a=1"
    assert (
        scrubbed["breadcrumbs"]["values"][0]["data"]["url"]
        == "https://x.example.com/cb?secret=[redacted]&ok=1"
    )
    assert (
        scrubbed["breadcrumbs"]["values"][1]["data"]["http.query"]
        == "X-Amz-Signature=[redacted]&ok=1"
    )
    assert (
        scrubbed["exception"]["values"][0]["value"]
        == "403 Client Error for url: https://r2/f?X-Amz-Signature=[redacted]"
    )
