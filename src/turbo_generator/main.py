from urllib.request import Request, urlopen
import re
import openai
from pathlib import Path
import key
import time
openai.api_key = key.api_key

links_path = Path('.',  '..' , 'nyt_scraper' ,'links')
links_files = [x for x in links_path.iterdir() if x.suffix == '.txt']
links_files = sorted(links_files, key=lambda f: f.name)
data_path = Path('data')
if not data_path.exists():
    data_path.mkdir()

total_count = 0
MAX_COUNT = 2000

def get_title(url):
    req = Request(
        url=url, 
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    webpage = urlopen(req).read().decode('utf-8')
    r = re.search('<title.*>(.*?)</title>', webpage)
    return r.group(1) if r else ""


def create_article(title):
    response = openai.ChatCompletion.create(
    model="gpt-3.5-turbo",
    messages=[
            {"role": "system", "content": "You are a writer."},
            {"role": "user", "content": f"Write and article with title \"{title}\" "},
        ]
    )
    text = response['choices'][0]['message']['content']
    lines = text.split('\n')
    if lines[0].strip() == title:
        # filter out titles
        text = text.replace(title, '', 1).strip()
    return text


for link_file in links_files:
    counter = 0
    links = link_file.open().readlines()
    links = [l.strip() for l in links]
    links = [l.split('?')[0] if '?' in l else l for l in links]
    for link in links:
        total_count += 1
        counter += 1
        output_filename = f"{link_file.name.split('.')[0]}_{counter}.txt"
        output = data_path / output_filename
        print(total_count, output.name)
        if output.exists():
            continue
        title = get_title(link)
        if not len(title):
            print(f"title not found: {link}")
            total_count -= 1
            continue
        text = create_article(title)
        output.write_text(text)
        print(output.name, len(text))
        if total_count >= MAX_COUNT:
            exit(0)
        time.sleep(20) # open ai rate limit