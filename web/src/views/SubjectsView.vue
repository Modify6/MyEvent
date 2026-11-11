<script setup>
// 对象列表:彩色首字头像 + 类型彩签 + 统计徽标
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSubjectStore } from '../stores/subject.js';
import { useEventStore } from '../stores/event.js';
import { useThoughtStore } from '../stores/thought.js';
import { usePredictionStore } from '../stores/prediction.js';
import SubjectForm from '../components/SubjectForm.vue';
import ConfidenceBar from '../components/ConfidenceBar.vue';
import { typeColor, avatarColor } from '../lib/display.js';

const router = useRouter();
const store = useSubjectStore();
const eventStore = useEventStore();
const thoughtStore = useThoughtStore();
const predictionStore = usePredictionStore();
const showForm = ref(false);

// 每对象统计:线索 / 记录 / 预判
const statsOf = (id) => ({
  threads: eventStore.active.filter((e) => (e.subjectIds || []).includes(id)).length,
  notes: thoughtStore.ofSubject(id).length,
  preds: predictionStore.ofSubject(id).length,
});
const avatarStyle = (s) => {
  const c = avatarColor(s.id);
  return { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c };
};
const typeStyle = (s) => {
  const c = typeColor(s.type);
  return { color: c, borderColor: c + '59', background: c + '1f' };
};
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>对象</h1>
      <van-button size="small" round type="primary" icon="plus" @click="showForm = true">新建</van-button>
    </div>

    <div class="hint-line hint-brand">🎯 对象 = 长期关注的主体(人 / 项目 / 公司 / 主题):想法挂上去,时间线就是认知演化史</div>

    <div v-if="store.active.length" class="card">
      <div v-for="s in store.active" :key="s.id" class="subj-line" @click="router.push(`/subjects/${s.id}`)">
        <div class="avatar" :style="avatarStyle(s)">{{ s.name.slice(0, 1) }}</div>
        <div class="row-main">
          <div class="row-title">
            {{ s.name }}
            <span class="type-tag" :style="typeStyle(s)">{{ s.type }}</span>
          </div>
          <div v-if="s.currentView" class="muted view-line">{{ s.currentView }}</div>
          <div class="muted stats">{{ statsOf(s.id).threads }} 线索 · {{ statsOf(s.id).notes }} 记录<template v-if="statsOf(s.id).preds"> · {{ statsOf(s.id).preds }} 预判</template></div>
        </div>
        <div class="right-col">
          <ConfidenceBar v-if="s.currentConfidence != null" :value="s.currentConfidence" style="width: 76px" />
          <van-icon name="arrow" color="var(--text-3)" />
        </div>
      </div>
    </div>
    <div v-else class="card">
      <div class="empty-tip">还没有对象。<br />把长期关注的一个人、一个项目、一个投资标的建进来,<br />它的事实、想法、预判都会在这里沉淀。</div>
      <van-button type="primary" round block @click="showForm = true">创建第一个对象</van-button>
    </div>

    <SubjectForm v-model:show="showForm" />
  </div>
</template>

<style scoped>
.subj-line { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.subj-line:last-child { border-bottom: 0; }
.avatar { flex: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 700; }
.row-main { flex: 1; min-width: 0; }
.row-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.type-tag { flex: none; font-size: 10px; border: 1px solid; border-radius: 4px; padding: 0 5px; font-weight: 600; }
.view-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
.stats { font-size: 11px; margin-top: 2px; }
.right-col { display: flex; align-items: center; gap: 8px; }
</style>
