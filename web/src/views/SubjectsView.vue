<script setup>
// 对象列表:人/项目/公司/投资标的等长期关注单元
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSubjectStore } from '../stores/subject.js';
import SubjectForm from '../components/SubjectForm.vue';
import ConfidenceBar from '../components/ConfidenceBar.vue';

const router = useRouter();
const store = useSubjectStore();
const showForm = ref(false);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>对象</h1>
      <van-button size="small" round type="primary" icon="plus" @click="showForm = true">新建</van-button>
    </div>

    <div class="hint-line">对象 = 长期关注的主体(人 / 项目 / 公司 / 主题):想法挂上去,时间线就是认知演化史</div>
    <div v-if="store.active.length" class="card">
      <div v-for="s in store.active" :key="s.id" class="subj-line" @click="router.push(`/subjects/${s.id}`)">
        <div class="row-main">
          <div class="row-title">
            {{ s.name }}
            <van-tag plain round size="medium" class="type-tag">{{ s.type }}</van-tag>
          </div>
          <div v-if="s.currentView" class="muted view-line">{{ s.currentView }}</div>
          <div v-if="s.tags?.length" class="muted"># {{ s.tags.join(' # ') }}</div>
        </div>
        <div class="right-col">
          <ConfidenceBar v-if="s.currentConfidence != null" :value="s.currentConfidence" style="width: 90px" />
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
.hint-line { font-size: 12px; color: var(--text-3); margin: -2px 2px 8px; }
.subj-line { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.subj-line:last-child { border-bottom: 0; }
.row-main { flex: 1; min-width: 0; }
.row-title { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.type-tag { flex: none; }
.view-line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
.right-col { display: flex; align-items: center; gap: 8px; }
</style>
