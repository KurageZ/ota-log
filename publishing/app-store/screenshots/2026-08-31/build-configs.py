"""Generate Koubou config files; all rendered UI comes from raw simulator PNGs."""
from pathlib import Path
import yaml
root = Path(__file__).resolve().parent
slides = [
 ('01-home','night','你的偶活记录本','把喜欢的现场，','认真收藏。','演出记录 · 电子切册 · 偶活统计'),
 ('02-cheki','rose','电子切册','每一张拍立得，','都有它的故事。','照片、艺人、活动与备注，一起收好'),
 ('03-event','','活动计划','下一次见面，','安排得明明白白。','日期、场地、出演者与时间表，一目了然'),
 ('04-artist','rose','喜欢的艺人','关于你的单推，','多留一点位置。','专属背景、活动足迹与拍立得回忆'),
 ('05-calendar','blue','拍立得日历','翻开日历，','那天的心动还在。','用照片回看日常，用日程期待下一场'),
 ('06-stats','night','偶活统计','原来这份喜欢，','已经积攒了这么多。','活动、拍立得与花费，按自己的习惯回顾'),
]
variants = [
 ('iphone', 'iphone', [1320,2868], 'iphone-6.9', 'iphone.yaml'),
 ('ipad', 'ipad', [2064,2752], 'ipad-13', 'ipad.yaml'),
 ('iphone', 'iphone iphone-65', [1284,2778], 'iphone-6.5', 'iphone-6.5.yaml'),
]
for device,css_class,size,folder,filename in variants:
 config={'project':{'name':'ota log — First Store Release','device':'iPhone 16 Pro - Black Titanium - Portrait','output_dir':f'export/{folder}','output_size':size},'screenshots':{}}
 for i,(name,theme,category,line1,line2,subtitle) in enumerate(slides,1):
  config['screenshots'][name]={'frame':False,'template':'templates/slide.html','assets':{'screen':f'raw/{device}/{name}.png','icon':'assets/app-icon.png'},'variables':{'device':css_class,'theme':theme,'category':category,'line1':line1,'line2':line2,'subtitle':subtitle,'number':f'{i:02}'}}
 (root/filename).write_text(yaml.safe_dump(config,allow_unicode=True,sort_keys=False))
print('Wrote iphone.yaml, ipad.yaml and iphone-6.5.yaml')
