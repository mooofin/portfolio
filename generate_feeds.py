#!/usr/bin/env python3
"""
Generate feed.xml (RSS) and llm.txt from blog.html and posts
"""

import os
import re
import datetime
import email.utils

BASE_URL = "https://mooofin.github.io/portfolio/"
BLOG_HTML_PATH = "blog.html"
FEED_XML_PATH = "feed.xml"
LLM_TXT_PATH = "llm.txt"

def escape_xml(text):
    if not text:
        return ""
    return (text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&apos;"))

def get_post_description(filepath):
    if not os.path.exists(filepath):
        return ""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            html = f.read()
        
        # Try matching different meta description formats using backreferences for quotes
        patterns = [
            r'<meta\s+[^>]*name=["\']description["\']\s+content=(["\'])(.*?)\1',
            r'<meta\s+[^>]*content=(["\'])(.*?)\1\s+name=["\']description["\']',
            r'<meta\s+[^>]*property=["\']og:description["\']\s+content=(["\'])(.*?)\1',
            r'<meta\s+[^>]*content=(["\'])(.*?)\1\s+property=["\']og:description["\']',
        ]
        
        for p in patterns:
            m = re.search(p, html, re.IGNORECASE)
            if m:
                # Group 2 has the actual content (Group 1 is the quote character)
                desc = m.group(2).strip()
                if desc:
                    return " ".join(desc.split())
                    
        # Fallback: extract first non-empty descriptive paragraph
        p_matches = re.findall(r'<p\b[^>]*>([\s\S]*?)</p>', html, re.IGNORECASE)
        for p_content in p_matches:
            # Strip tags and normalize spacing
            text = re.sub(r'<[^>]+>', '', p_content)
            text = " ".join(text.split()).strip()
            # Skip short utility text or menu items
            if len(text) > 40 and not text.startswith("Hi, I'm") and not text.startswith("Browse the archive"):
                if len(text) > 200:
                    text = text[:197] + "..."
                return text
    except Exception as e:
        print(f"Error reading description for {filepath}: {e}")
    return ""

def main():
    if not os.path.exists(BLOG_HTML_PATH):
        print(f"Error: {BLOG_HTML_PATH} not found.")
        return

    with open(BLOG_HTML_PATH, "r", encoding="utf-8") as f:
        blog_html = f.read()

    # Get the visible table content (the last table of class table-95)
    parts = blog_html.split('<table class="table-95">')
    if len(parts) < 2:
        print("Error: Could not find table.table-95 in blog.html")
        return
    
    visible_table = parts[-1]

    # Regex to find all rows:
    # <tr>
    #   <td>YYYY-MM-DD</td>
    #   <td><a href="...">Title</a></td>
    # </tr>
    row_pattern = re.compile(
        r'<tr>\s*<td>\s*(\d{4}-\d{2}-\d{2})\s*</td>\s*<td>\s*<a\s+href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*</a\s*>\s*</td>\s*</tr>',
        re.IGNORECASE
    )

    posts = []
    for match in row_pattern.finditer(visible_table):
        date_str, href, title_html = match.groups()
        # Clean up title (remove html tags, linebreaks, collapse spaces)
        title = re.sub(r'<[^>]+>', '', title_html)
        title = " ".join(title.split()).strip()
        
        filepath = os.path.join(os.path.dirname(BLOG_HTML_PATH), href)
        description = get_post_description(filepath)
        
        # Convert date to RFC 822 format
        try:
            dt = datetime.datetime.strptime(date_str, "%Y-%m-%d")
            dt = dt.replace(tzinfo=datetime.timezone.utc)
            pub_date = email.utils.format_datetime(dt)
        except Exception as e:
            print(f"Error parsing date {date_str}: {e}")
            pub_date = date_str

        posts.append({
            "date": date_str,
            "pub_date": pub_date,
            "href": href,
            "url": BASE_URL + href.lstrip("/"),
            "title": title,
            "description": description
        })

    print(f"Parsed {len(posts)} posts from {BLOG_HTML_PATH}")

    # Generate feed.xml
    now = datetime.datetime.now(datetime.timezone.utc)
    last_build_date = email.utils.format_datetime(now)

    xml_lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        f'    <title>mooofin\'s Blog</title>',
        f'    <link>{BASE_URL}</link>',
        f'    <description>Blog posts on systems programming, compilers, reverse engineering, and digital forensics by sid.</description>',
        '    <language>en-us</language>',
        f'    <lastBuildDate>{last_build_date}</lastBuildDate>',
        f'    <atom:link href="{BASE_URL}feed.xml" rel="self" type="application/rss+xml" />',
    ]

    for post in posts:
        xml_lines.extend([
            '    <item>',
            f'      <title>{escape_xml(post["title"])}</title>',
            f'      <link>{escape_xml(post["url"])}</link>',
            f'      <guid isPermaLink="true">{escape_xml(post["url"])}</guid>',
            f'      <pubDate>{post["pub_date"]}</pubDate>',
            f'      <description>{escape_xml(post["description"])}</description>',
            '    </item>'
        ])

    xml_lines.extend([
        '  </channel>',
        '</rss>'
    ])

    with open(FEED_XML_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(xml_lines) + "\n")
    print(f"Generated {FEED_XML_PATH}")

    # Generate llm.txt
    llm_lines = [
        '# mooofin\'s Homepage',
        '',
        '> Blog posts on systems programming, compilers, reverse engineering, and digital forensics by sid.',
        '',
        '## Pages',
        f'- [Home]({BASE_URL}index.html) - Welcome to my Homepage (Featured projects, latest updates).',
        f'- [About Me]({BASE_URL}about.html) - About Siddharth (NixOS, Gentoo, systems programming).',
        f'- [Projects]({BASE_URL}projects.html) - Software, reverse engineering tools, and plugin projects.',
        f'- [Blog]({BASE_URL}blog.html) - Chronological archive of all articles.',
        f'- [Contact]({BASE_URL}contact.html) - Contact info and social profiles.',
        f'- [Newsletter]({BASE_URL}newsletter.html) - Sign up for article notifications.',
        '',
        '## Articles',
        ''
    ]

    for post in posts:
        llm_lines.extend([
            f'### [{post["title"]}]({post["url"]})',
            f'**Date:** {post["date"]}  ',
            f'**Description:** {post["description"] if post["description"] else "No description available."}',
            ''
        ])

    with open(LLM_TXT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(llm_lines))
    print(f"Generated {LLM_TXT_PATH}")

if __name__ == "__main__":
    main()
