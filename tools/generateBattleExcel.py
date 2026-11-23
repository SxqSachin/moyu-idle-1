import pandas as pd

# 创建角色属性 Sheet
role_data = {
    '字段': ['等级', '基础攻击力', '暴击率', '暴击伤害', '技能伤害加成', '攻击速度', '其他增益'],
    '值': [50, 500, 0.25, 1.5, 1.2, 1.2, 0.1],
    '说明': ['角色等级', '武器+角色基础攻击', '百分比', '百分比', '百分比', '每秒攻击次数', '百分比']
}
df_role = pd.DataFrame(role_data)

# 创建装备属性 Sheet
equip_data = {
    '装备名称': ['武器A', '防具B'],
    '攻击力': [50, 0],
    '暴击率': [0.05, 0],
    '技能加成': [0.1, 0],
    '特殊效果': ['对火系+20%', '受伤减5%'],
    '备注': ['可选', '可选']
}
df_equip = pd.DataFrame(equip_data)

# 创建技能参数 Sheet
skill_data = {
    '技能名称': ['火球术', '旋风斩'],
    '基础伤害': [1000, 500],
    '目标数量': [3, 5],
    '技能消耗': [20, 15],
    '技能CD': [5, 3],
    '伤害类型': ['法术', '物理'],
    '技能倍率': [1.2, 1.0]
}
df_skill = pd.DataFrame(skill_data)

# 创建敌人属性 Sheet
enemy_data = {
    '敌人名称': ['哥布林', '火元素'],
    '等级': [10, 12],
    '血量': [5000, 8000],
    '防御': [50, 30],
    '属性抗性': [0.2, 0.5],
    '特殊效果': ['普通敌人', '伤害加成']
}
df_enemy = pd.DataFrame(enemy_data)

# 创建战斗模拟 Sheet
battle_data = {
    '回合': [1, 2],
    '技能使用': ['火球术', '旋风斩'],
    '技能伤害': ['=Sheet1!B2*Sheet3!G2', '=Sheet1!B2*Sheet3!G3'],
    '暴击伤害': ['=C2*(1+Sheet1!B3*(Sheet1!B4-1))', '=C3*(1+Sheet1!B3*(Sheet1!B4-1))'],
    '实际伤害': ['=D2*(1-Sheet4!D2/(Sheet4!D2+100))*(1-Sheet4!E2)', '=D3*(1-Sheet4!D3/(Sheet4!D3+100))*(1-Sheet4!E3)'],
    '敌人剩余血量': ['=Sheet4!C2-E2', '=Sheet4!C3-E3']
}
df_battle = pd.DataFrame(battle_data)

# 写入 Excel
file_path = '放置类游戏战斗模拟.xlsx'
with pd.ExcelWriter(file_path, engine='xlsxwriter') as writer:
    df_role.to_excel(writer, sheet_name='角色属性', index=False)
    df_equip.to_excel(writer, sheet_name='装备属性', index=False)
    df_skill.to_excel(writer, sheet_name='技能参数', index=False)
    df_enemy.to_excel(writer, sheet_name='敌人属性', index=False)
    df_battle.to_excel(writer, sheet_name='战斗模拟', index=False)

print(f'Excel 文件已生成: {file_path}')
