import os

import discord_webhook
import tabulate
import json

MAX_POST_LEN = 1990

def main():
    driver_standings = json.load(open('./data/seasons/season2/driver_standings.json', 'r', encoding='utf-8'))
    trimmed_standings = list()
    for row in driver_standings["standings"]:
        row_dict = dict()
        names = row["name"].rsplit(" ")
        last_name = names.pop()
        abbr_name = ""
        for name in names:
            abbr_name += name[0]+". "
        abbr_name += last_name
        row_dict["name"] = abbr_name
        for k in ('team', 'championshipPoints', 'totalPoints'):
            row_dict[k] = row[k]
        trimmed_standings.append(row_dict)

    table = tabulate.tabulate(trimmed_standings,
                              headers={'name': 'Driver',
                                       'team': 'Team',
                                       "championshipPoints": 'Pts w/drop',
                                       "totalPoints": "All Pts"},
                              maxcolwidths=[None, None, 4, 4],
                              maxheadercolwidths=[None, None, 5, 5],
                              tablefmt="fancy_outline")
    lines = table.split('\n')
    current_post_length = 0
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

    for (idx,lines) in enumerate(posts):
        t = '\n'.join(lines)
        webhook = discord_webhook.DiscordWebhook(url=os.getenv("WEBHOOK_URL"),
                                                 id=os.getenv(f"MESSAGE_{idx}_ID", None))
        webhook.content=f"```{t}```"
        webhook.execute()

if __name__ == "__main__":
    main()
