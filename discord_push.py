import os

import discord_webhook
import tabulate
import json

MAX_POST_LEN = 1990

def main():
    driver_standings = json.load(open('./data/seasons/season2/driver_standings.json', 'r', encoding='utf-8'))
    trimmed_standings = list()
    for (pos, row) in enumerate(driver_standings["standings"], 1):
        row_dict = dict()
        names = row["name"].rsplit(" ")
        last_name = names.pop()
        abbr_name = ""
        for name in names:
            abbr_name += name[0]+". "
        abbr_name += last_name
        row_dict["pos"] = pos
        row_dict["name"] = abbr_name
        for k in ('team', 'championshipPoints', 'totalPoints'):
            row_dict[k] = row[k]
        trimmed_standings.append(row_dict)

    table = tabulate.tabulate(trimmed_standings,
                              headers={'pos': 'Pos',
                                       'name': 'Driver',
                                       'team': 'Team',
                                       "championshipPoints": 'Pts w/drop',
                                       "totalPoints": "All Pts"},
                              maxcolwidths=[2, None, None, 4, 4],
                              maxheadercolwidths=[3, None, None, 5, 5],
                              tablefmt="fancy_outline")
    lines = table.split('\n')
    main_site_link = os.getenv("SITE_URL")
    current_post_length = len(main_site_link) if main_site_link else 0
    posts = list()
    current_post_idx = 0
    posts.append([])
    for line_idx, line in enumerate(lines):
        line_length = (len(line) + len("\n"))
        if (current_post_length + line_length) >= MAX_POST_LEN:
            current_post_idx += 1
            posts.append([])
            current_post_length = 0
        posts[current_post_idx].append(line)
        current_post_length += line_length

    post_idx = 0
    while os.getenv(f"MESSAGE_{post_idx}_ID", None) is not None:
        webhook = discord_webhook.DiscordWebhook(url=os.getenv("WEBHOOK_URL"),
                                                 id=os.getenv(f"MESSAGE_{post_idx}_ID"))
        post_idx+=1
        print(f"Deleting webhook post {webhook.id}")
        webhook.delete()

    message_list = list()
    for (idx,lines) in enumerate(posts):
        t = '\n'.join(lines)
        webhook = discord_webhook.DiscordWebhook(url=os.getenv("WEBHOOK_URL"))
        content = ""
        if main_site_link and idx == 0:
            content += main_site_link + '\n'
        content += f"```{t}```"
        print(content)
        webhook.content=content
        webhook.execute()
        print(webhook.id)
        message_list.append({"num": str(idx), "id": str(webhook.id)})

    matrix_dict = {"include": message_list}
    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write(f"matrix={json.dumps(matrix_dict)}")

if __name__ == "__main__":
    main()
