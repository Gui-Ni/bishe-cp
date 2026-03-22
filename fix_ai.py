# -*- coding: utf-8 -*-
import re

with open(r'C:\Users\admin\.openclaw\workspace\bishe-cp\src\App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''  // 【修复】：彻底修改 AI System Prompt，只保留原话，仅作错别字修正
  const submitIdea = async () => {
    if (!ideaInput.trim()) return;
    setIdeaModal('processing');
    try {
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
        body: JSON.stringify({ 
          model: "abab6.5s-chat", 
          messages:[ 
            { 
              role: "system", 
              content: "你是一个语音错字纠正助手。请仅仅修复用户输入文本中的错别字，并去掉'啊'、'呃'、'那个'等无意义的语气词，使句子通顺。必须完全保留用户的原意和第一人称语气，绝对不要去总结它，不要擅自加上任何解释，前缀或套话。直接输出修正后的原话。" 
            }, 
            { role: "user", content: ideaInput } 
          ] 
        })
      });
      if (!response.ok) throw new Error('API Failed');
      const data = await response.json();
      addCard(data.choices[0].message.content);
    } catch (error) {
      addCard(ideaInput); 
    } finally { closeIdeaModal(); }
  };'''

new = '''  // AI 整理用户输入：只修正错别字和语气词，保留原意
  const submitIdea = async () => {
    if (!ideaInput.trim()) return;
    setIdeaModal('processing');
    
    try {
      const response = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${MINIMAX_API_KEY}` 
        },
        body: JSON.stringify({ 
          model: "abab6.5s-chat", 
          messages:[ 
            { 
              role: "system", 
              content: "你是一个文字整理助手。请把用户口语化的输入整理得通顺简洁，只修正明显的错别字和口头禅（如'啊'、'嗯'、'那个'等），保留原意。直接输出整理后的句子，不要加任何前缀、解释或诗意表达。" 
            }, 
            { role: "user", content: ideaInput } 
          ] 
        })
      });
      
      if (!response.ok) throw new Error('API Failed');
      
      const data = await response.json();
      const result = data.choices?.[0]?.message?.content;
      
      if (result && result.trim()) {
        addCard(result.trim());
      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      // API失败时直接保存原话，不显示错误提示
      addCard(ideaInput); 
    } finally { 
      closeIdeaModal(); 
    }
  };'''

if old in content:
    content = content.replace(old, new)
    with open(r'C:\Users\admin\.openclaw\workspace\bishe-cp\src\App.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done!')
else:
    print('Not found - trying simpler replacement')
    # Try simpler approach
    old2 = '你是一个语音错字纠正助手'
    new2 = '你是一个文字整理助手'
    if old2 in content:
        content = content.replace(old2, new2)
        with open(r'C:\Users\admin\.openclaw\workspace\bishe-cp\src\App.tsx', 'w', encoding='utf-8') as f:
            f.write(content)
        print('Done with simpler replacement!')
    else:
        print('Pattern not found at all')
