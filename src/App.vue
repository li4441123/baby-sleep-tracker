<template>
  <main :class="['app-shell', { 'is-dark': settings.darkMode }]">
    <section class="topbar">
      <div>
        <h1>{{ selectedBaby?.name || '添加宝宝' }}</h1>
        <p class="top-subtitle">{{ currentPlan?.name || '记录睡眠和睡姿' }}</p>
      </div>
      <button
        class="icon-button theme-toggle"
        type="button"
        :title="settings.darkMode ? '切换日间模式' : '切换夜间模式'"
        :aria-label="settings.darkMode ? '切换日间模式' : '切换夜间模式'"
        @click="settings.darkMode = !settings.darkMode; persistSettings()"
      >
        <Sun v-if="settings.darkMode" :size="21" />
        <Moon v-else :size="20" />
      </button>
    </section>

    <section v-if="!selectedBaby" class="empty-state">
      <h2>先添加宝宝资料</h2>
      <p>添加后就可以建立睡姿方案；如果你已有备份，也可以直接导入恢复数据。</p>
      <div class="action-row">
        <van-button round block color="#7c9a92" @click="openBabyEditor()">添加宝宝</van-button>
        <van-button round block plain color="#7c9a92" @click="triggerImport">导入备份</van-button>
      </div>
      <input ref="fileInput" class="file-input" type="file" accept="application/json" @change="handleImport" />
    </section>

    <template v-else>
      <section v-if="activeTab === 'home'" class="page">
        <div class="hero-panel">
          <div>
            <p class="muted">{{ currentPlan?.name || '还没有当前方案' }}</p>
            <h2>{{ runningRecord ? '正在睡眠中' : '准备记录睡眠' }}</h2>
          </div>
          <div class="hero-time">
            {{ runningRecord ? liveDuration : todayTotalText }}
          </div>
        </div>

        <div v-if="currentPlan" class="position-grid">
          <button
            v-for="position in currentPlan.positions"
            :key="position.id"
            type="button"
            :class="['position-choice', { selected: selectedPositionId === position.id }]"
            :style="{ '--accent': position.color }"
            @click="selectedPositionId = position.id"
          >
            <span>{{ position.name }}</span>
            <strong>{{ position.targetPercent }}%</strong>
          </button>
        </div>

        <div class="action-row">
          <van-button
            v-if="!runningRecord"
            round
            block
            color="#7c9a92"
            :disabled="!canStart"
            @click="openStartEditor"
          >
            开始睡眠
          </van-button>
          <van-button v-else round block color="#d98b73" @click="openFinishEditor">结束睡眠</van-button>
          <van-button round block plain color="#7c9a92" @click="openManualEditor()">补录</van-button>
        </div>

        <div class="hint-strip">{{ todayHint }}</div>

        <section class="panel">
          <div class="section-title">
            <h3>今日时间轴</h3>
            <span>{{ todayRecords.length }} 段</span>
          </div>
          <div v-if="todayRecords.length" class="timeline">
            <div
              v-for="record in todayRecords"
              :key="record.id"
              class="timeline-item"
              :style="timelineStyle(record)"
              @click="openRecordEditor(record)"
            >
              <span>{{ positionName(record.positionId) }}</span>
            </div>
          </div>
          <p v-else class="muted center">今天还没有记录</p>
        </section>
      </section>

      <section v-if="activeTab === 'stats'" class="page">
        <van-tabs v-model:active="statsDaysIndex" shrink color="#7c9a92" background="transparent">
          <van-tab title="今日" />
          <van-tab title="近7天" />
          <van-tab title="近30天" />
        </van-tabs>
        <div class="stat-summary">
          <div>
            <p class="muted">总睡眠</p>
            <h2>{{ formatDuration(activeStats.totalMs) }}</h2>
            <p class="muted">{{ currentPlan?.name }}</p>
          </div>
          <div class="ring" :style="ringStyle">
            <span>{{ completionCount }}/{{ activeStats.positions.length }}</span>
          </div>
        </div>

        <section class="panel">
          <div class="section-title">
            <h3>占比概览</h3>
            <span>{{ statsDays === 1 ? '今日' : `${statsDays}天` }}</span>
          </div>
          <div class="stacked-bar" aria-label="睡姿占比">
            <div
              v-for="item in activeStats.positions"
              :key="item.id"
              :style="{ width: `${Math.max(item.actualPercent, activeStats.totalMs ? 4 : 0)}%`, background: item.color }"
            />
          </div>
          <div class="legend-grid">
            <div v-for="item in activeStats.positions" :key="item.id">
              <i :style="{ background: item.color }" />
              <span>{{ item.name }}</span>
              <strong>{{ formatPercent(item.actualPercent) }}%</strong>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <h3>每日趋势</h3>
            <span>按结束日期统计</span>
          </div>
          <div class="day-bars">
            <div v-for="day in dayBars" :key="day.key" class="day-bar">
              <span>{{ day.label }}</span>
              <div><i :style="{ height: `${day.percent}%` }" /></div>
              <strong>{{ day.short }}</strong>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <h3>睡姿目标</h3>
            <span>{{ completionCount }}项完成</span>
          </div>
          <div v-for="item in activeStats.positions" :key="item.id" class="stat-line">
            <div class="stat-line-head">
              <strong>{{ item.name }}</strong>
              <span :class="{ done: item.completed }">
                {{ item.completed ? '已完成' : activeStats.totalMs ? `${formatPercent(item.catchUpPercent)}%差距 · 还差约${formatDuration(item.catchUpMs)}` : '暂无数据' }}
              </span>
            </div>
            <van-progress
              :percentage="Math.min(100, item.actualPercent)"
              :color="item.color"
              track-color="rgba(70, 90, 85, .12)"
              stroke-width="8"
              :show-pivot="false"
            />
            <div class="stat-meta">
              <span>实际 {{ formatPercent(item.actualPercent) }}%</span>
              <span>目标 {{ item.targetPercent }}%</span>
              <span>{{ formatDuration(item.durationMs) }}</span>
            </div>
          </div>
        </section>
      </section>

      <section v-if="activeTab === 'plans'" class="page">
        <div class="section-title">
          <h3>睡姿方案</h3>
          <van-button class="primary-mini-button" size="small" round color="#7c9a92" @click="openPlanEditor()">新增方案</van-button>
        </div>
        <div v-if="!babyPlans.length" class="empty-state">
          <h2>还没有睡姿方案</h2>
          <p>先添加一组睡姿和目标占比，再开始记录睡眠。</p>
          <van-button round block color="#7c9a92" @click="openPlanEditor()">创建第一个方案</van-button>
        </div>
        <div v-for="plan in babyPlans" :key="plan.id" class="list-tile">
          <div>
            <h3>{{ plan.name }}</h3>
            <p>{{ plan.positions.map((p) => `${p.name} ${p.targetPercent}%`).join(' / ') }}</p>
            <span v-if="plan.id === selectedBaby.currentPlanId" class="tag">当前默认</span>
          </div>
          <div class="tile-actions">
            <button type="button" @click="setCurrentPlan(plan.id)">设默认</button>
            <button type="button" @click="openPlanEditor(plan)">编辑</button>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'records'" class="page">
        <div class="section-title">
          <h3>睡眠记录</h3>
          <van-button class="primary-mini-button" size="small" round color="#7c9a92" @click="openManualEditor()">补录</van-button>
        </div>
        <div v-for="record in sortedRecords" :key="record.id" class="list-tile" @click="openRecordEditor(record)">
          <div>
            <h3>{{ positionName(record.positionId) }}</h3>
            <p>{{ formatDateTime(record.startedAt) }} - {{ record.endedAt ? formatDateTime(record.endedAt) : '进行中' }}</p>
          </div>
          <span class="tag">{{ record.source === 'manual' ? '补录' : '实时' }}</span>
        </div>
      </section>

      <section v-if="activeTab === 'settings'" class="page">
        <div class="baby-card">
          <div>
            <p class="muted">当前宝宝</p>
            <h2>{{ selectedBaby.name }}</h2>
            <p>{{ gestationalText }}</p>
            <p>{{ ageText }}</p>
            <p v-if="prematureText">{{ prematureText }}</p>
            <p v-if="correctedAgeText">{{ correctedAgeText }}</p>
          </div>
          <van-button size="small" round plain color="#7c9a92" @click="openBabyEditor(selectedBaby)">编辑</van-button>
        </div>

        <section class="panel">
          <div class="section-title">
            <h3>宝宝管理</h3>
            <van-button class="primary-mini-button" size="small" round color="#7c9a92" @click="openBabyEditor()">新增宝宝</van-button>
          </div>
          <div class="baby-switcher">
            <button
              v-for="baby in babies"
              :key="baby.id"
              type="button"
              :class="{ active: baby.id === selectedBaby.id }"
              @click="selectBaby(baby.id)"
            >
              <strong>{{ baby.name }}</strong>
              <span>{{ baby.birthday }}</span>
            </button>
          </div>
        </section>

        <section class="panel">
          <div class="section-title">
            <h3>数据备份</h3>
            <span>{{ settings.lastBackupAt ? formatDateTime(settings.lastBackupAt) : '未备份' }}</span>
          </div>
          <div class="action-row">
            <van-button round block color="#7c9a92" @click="downloadBackup">导出</van-button>
            <van-button round block plain color="#7c9a92" @click="triggerImport">导入</van-button>
          </div>
          <input ref="fileInput" class="file-input" type="file" accept="application/json" @change="handleImport" />
        </section>

        <section class="panel">
          <div class="section-title">
            <h3>本机数据</h3>
            <span>仅影响当前设备</span>
          </div>
          <p class="muted">清空后宝宝、方案、睡眠记录都会从当前浏览器删除。建议先导出备份。</p>
          <div class="danger-action">
            <van-button size="small" round plain color="#d98b73" @click="clearLocalData">清空本机数据</van-button>
          </div>
        </section>
      </section>
    </template>

    <nav class="bottom-nav">
      <button v-for="item in tabs" :key="item.key" :class="{ active: activeTab === item.key }" @click="activeTab = item.key">
        <component :is="item.icon" :size="20" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <van-popup v-model:show="showBabyEditor" round position="bottom" class="sheet">
      <h2>{{ editingBabyId ? '编辑宝宝' : '新增宝宝' }}</h2>
      <van-field v-model="babyForm.name" label="姓名" placeholder="宝宝姓名" />
      <van-field v-model="babyForm.birthday" label="生日" type="date" />
      <div class="two-fields">
        <van-field v-model.number="babyForm.gestationalWeeks" label="孕周" type="number" />
        <van-field v-model.number="babyForm.gestationalDays" label="天" type="number" />
      </div>
      <div class="sheet-tip">孕周用于早产儿矫正日期计算，例如 35 周 + 3 天。</div>
      <van-button round block color="#7c9a92" @click="saveBaby">保存</van-button>
    </van-popup>

    <van-popup v-model:show="showPlanEditor" round position="bottom" class="sheet">
      <h2>{{ editingPlanId ? '编辑方案' : '新增方案' }}</h2>
      <van-field v-model="planForm.name" label="方案名" placeholder="例如 头型调整第二阶段" />
      <div v-for="(item, index) in planForm.positions" :key="item.id" class="position-editor">
        <div class="position-editor-head">
          <span>睡姿 {{ index + 1 }}</span>
          <button type="button" @click="removePlanPosition(index)">删除</button>
        </div>
        <label class="form-block">
          <span>名称</span>
          <input v-model="item.name" type="text" placeholder="例如 左侧睡" />
        </label>
        <div class="position-editor-row">
          <label class="form-block percent-block">
            <span>目标</span>
            <input v-model.number="item.targetPercent" type="number" />
            <em>%</em>
          </label>
          <label class="color-picker">
            <span>颜色</span>
            <input v-model="item.color" class="color-input" type="color" />
          </label>
        </div>
      </div>
      <div class="sheet-subline">目标合计：{{ targetTotal }}%</div>
      <div class="action-row">
        <van-button round block plain color="#7c9a92" @click="addPlanPosition">添加睡姿</van-button>
        <van-button round block color="#7c9a92" @click="savePlan">保存</van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="showRecordEditor" round position="bottom" class="sheet">
      <h2>{{ editingRecordId ? '编辑记录' : '手动补录' }}</h2>
      <van-field v-model="recordForm.startedAt" label="开始" type="datetime-local" />
      <van-field v-model="recordForm.endedAt" label="结束" type="datetime-local" />
      <van-field label="方案">
        <template #input>
          <select v-model="recordForm.planId" class="native-select" @change="syncRecordPosition">
            <option value="">请选择方案</option>
            <option v-for="plan in babyPlans" :key="plan.id" :value="plan.id">
              {{ plan.name }}{{ plan.id === selectedBaby?.currentPlanId ? '（默认）' : '' }}
            </option>
          </select>
        </template>
      </van-field>
      <van-field label="睡姿">
        <template #input>
          <select v-model="recordForm.positionId" class="native-select">
            <option value="">请选择</option>
            <option v-for="position in recordPlan?.positions || []" :key="position.id" :value="position.id">
              {{ position.name }}
            </option>
          </select>
        </template>
      </van-field>
      <van-field v-model="recordForm.note" label="备注" placeholder="可选" />
      <div class="sheet-tip">补录会按结束时间所在日期计入统计；修改方案后只会使用该方案下的睡姿。</div>
      <div class="action-row">
        <van-button v-if="editingRecordId" round block plain color="#d98b73" @click="deleteRecord">删除</van-button>
        <van-button round block color="#7c9a92" @click="saveRecord">保存</van-button>
      </div>
    </van-popup>

    <van-popup v-model:show="showStartEditor" round position="bottom" class="sheet compact-sheet">
      <h2>开始睡眠</h2>
      <div class="start-summary" v-if="currentPlan && pendingPosition">
        <span :style="{ background: pendingPosition.color }" />
        <div>
          <strong>{{ pendingPosition.name }}</strong>
          <p>{{ currentPlan.name }}</p>
        </div>
      </div>
      <van-field v-model="startForm.startedAt" label="开始" type="datetime-local" />
      <div class="sheet-tip">默认是当前时间，可以按实际入睡时间往前调整。</div>
      <van-button round block color="#7c9a92" @click="startSleep">确认开始</van-button>
    </van-popup>

    <van-popup v-model:show="showFinishEditor" round position="bottom" class="sheet compact-sheet">
      <h2>结束睡眠</h2>
      <div class="start-summary" v-if="runningRecord">
        <span :style="{ background: positionColor(runningRecord.positionId) }" />
        <div>
          <strong>{{ positionName(runningRecord.positionId) }}</strong>
          <p>开始于 {{ formatDateTime(runningRecord.startedAt) }}</p>
        </div>
      </div>
      <van-field v-model="finishForm.endedAt" label="结束" type="datetime-local" />
      <div class="sheet-tip">默认是当前时间，可以按实际醒来时间调整。</div>
      <van-button round block color="#d98b73" @click="finishSleep">确认结束</van-button>
    </van-popup>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import { Baby, PositionPlan, SleepRecord } from './types'
import { db, exportBackup, importBackup, loadSettings, seedIfEmpty } from './lib/db'
import {
  createId,
  dateKey,
  formatDateTime,
  formatDuration,
  fromDateTimeLocalValue,
  nowIso,
  toDateTimeLocalValue,
} from './lib/time'
import { calculateStats, formatPercent, targetHint } from './lib/stats'
import { BarChart3, Baby as BabyIcon, ClipboardList, Home, Moon, Settings, Sun } from '@lucide/vue'

type TabKey = 'home' | 'stats' | 'plans' | 'records' | 'settings'

const tabs = [
  { key: 'home' as TabKey, label: '记录', icon: Home },
  { key: 'stats' as TabKey, label: '统计', icon: BarChart3 },
  { key: 'plans' as TabKey, label: '方案', icon: ClipboardList },
  { key: 'records' as TabKey, label: '记录表', icon: BabyIcon },
  { key: 'settings' as TabKey, label: '设置', icon: Settings },
]

const activeTab = ref<TabKey>('home')
const babies = ref<Baby[]>([])
const plans = ref<PositionPlan[]>([])
const records = ref<SleepRecord[]>([])
const settings = reactive({ id: 'settings' as const, selectedBabyId: undefined as string | undefined, lastBackupAt: undefined as string | undefined, darkMode: false })
const selectedPositionId = ref('')
const statsDaysIndex = ref(0)
const liveNow = ref(Date.now())
const fileInput = ref<HTMLInputElement>()

const showBabyEditor = ref(false)
const showPlanEditor = ref(false)
const showRecordEditor = ref(false)
const showStartEditor = ref(false)
const showFinishEditor = ref(false)
const editingBabyId = ref('')
const editingPlanId = ref('')
const editingRecordId = ref('')

const babyForm = reactive({ name: '', birthday: '', gestationalWeeks: 39, gestationalDays: 0 })
const planForm = reactive<{ name: string; positions: Array<{ id: string; name: string; targetPercent: number; color: string }> }>({ name: '', positions: [] })
const recordForm = reactive({ startedAt: '', endedAt: '', planId: '', positionId: '', note: '' })
const startForm = reactive({ startedAt: '' })
const finishForm = reactive({ endedAt: '' })

const selectedBaby = computed(() => babies.value.find((baby) => baby.id === settings.selectedBabyId) || babies.value[0])
const babyPlans = computed(() => plans.value.filter((plan) => plan.babyId === selectedBaby.value?.id))
const currentPlan = computed(() => babyPlans.value.find((plan) => plan.id === selectedBaby.value?.currentPlanId) || babyPlans.value[0])
const runningRecord = computed(() => records.value.find((record) => record.babyId === selectedBaby.value?.id && !record.endedAt))
const pendingPosition = computed(() => currentPlan.value?.positions.find((item) => item.id === selectedPositionId.value))
const sortedRecords = computed(() => records.value.filter((record) => record.babyId === selectedBaby.value?.id && record.planId === currentPlan.value?.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
const todayRecords = computed(() => sortedRecords.value.filter((record) => record.endedAt && dateKey(record.endedAt) === dateKey(new Date())))
const statsDays = computed(() => [1, 7, 30][statsDaysIndex.value])
const activeStats = computed(() => calculateStats(currentPlan.value, records.value, statsDays.value))
const todayStats = computed(() => calculateStats(currentPlan.value, records.value, 1))
const todayTotalText = computed(() => formatDuration(todayStats.value.totalMs))
const todayHint = computed(() => targetHint(todayStats.value))
const canStart = computed(() => Boolean(selectedBaby.value && currentPlan.value && selectedPositionId.value && !runningRecord.value))
const targetTotal = computed(() => planForm.positions.reduce((sum, item) => sum + Number(item.targetPercent || 0), 0))
const recordPlan = computed(() => babyPlans.value.find((plan) => plan.id === recordForm.planId))
const completionCount = computed(() => activeStats.value.positions.filter((item) => item.completed).length)
const ringStyle = computed(() => {
  let cursor = 0
  const slices = activeStats.value.positions.map((item) => {
    const start = cursor
    cursor += item.actualPercent
    return `${item.color} ${start}% ${cursor}%`
  })
  return { background: `conic-gradient(${slices.join(', ') || '#d8d2c6 0 100%'})` }
})
const liveDuration = computed(() => runningRecord.value ? formatDuration(liveNow.value - new Date(runningRecord.value.startedAt).getTime()) : '0分钟')
const dayBars = computed(() => {
  const today = new Date()
  const keys = Array.from({ length: statsDays.value }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (statsDays.value - 1 - index))
    return dateKey(date)
  })
  const max = Math.max(1, ...keys.map((key) => activeStats.value.days[key] || 0))
  return keys.map((key) => {
    const ms = activeStats.value.days[key] || 0
    return {
      key,
      label: key.slice(5).replace('-', '/'),
      percent: Math.max(ms ? 8 : 0, Math.trunc((ms / max) * 100)),
      short: ms ? formatDuration(ms).replace('小时', 'h').replace('分钟', 'm') : '0',
    }
  })
})

const ageText = computed(() => {
  if (!selectedBaby.value) return ''
  const days = Math.max(0, Math.floor((Date.now() - new Date(selectedBaby.value.birthday).getTime()) / 86400000))
  return `实际月龄 ${Math.floor(days / 30)}月${days % 30}天`
})

const gestationalText = computed(() => {
  if (!selectedBaby.value) return ''
  return `出生孕周 ${selectedBaby.value.gestationalWeeks}周+${selectedBaby.value.gestationalDays}天`
})

const prematureText = computed(() => {
  const baby = selectedBaby.value
  if (!baby) return ''
  const bornDays = baby.gestationalWeeks * 7 + baby.gestationalDays
  const fullTermDays = 40 * 7
  const early = fullTermDays - bornDays
  if (early <= 0) return ''
  return `早产 ${Math.floor(early / 7)}周+${early % 7}天`
})

const correctedAgeText = computed(() => {
  const baby = selectedBaby.value
  if (!baby) return ''
  const bornDays = baby.gestationalWeeks * 7 + baby.gestationalDays
  const earlyDays = 40 * 7 - bornDays
  if (earlyDays <= 0) return ''
  const actualDays = Math.floor((Date.now() - new Date(baby.birthday).getTime()) / 86400000)
  const correctedDays = Math.max(0, actualDays - earlyDays)
  return `矫正天数 ${correctedDays}天（约${Math.floor(correctedDays / 30)}月${correctedDays % 30}天）`
})

async function refresh() {
  await seedIfEmpty()
  babies.value = await db.babies.toArray()
  plans.value = await db.plans.toArray()
  records.value = await db.records.toArray()
  Object.assign(settings, await loadSettings())
  if (selectedBaby.value && !settings.selectedBabyId) {
    settings.selectedBabyId = selectedBaby.value.id
    await persistSettings()
  }
  selectedPositionId.value = currentPlan.value?.positions[0]?.id || ''
}

async function persistSettings() {
  await db.settings.put({ ...settings })
}

async function selectBaby(babyId: string) {
  settings.selectedBabyId = babyId
  await persistSettings()
  await refresh()
}

function openStartEditor() {
  if (!canStart.value) return
  startForm.startedAt = toDateTimeLocalValue()
  showStartEditor.value = true
}

async function startSleep() {
  if (!canStart.value || !selectedBaby.value || !currentPlan.value) return
  const timestamp = nowIso()
  const startedAt = fromDateTimeLocalValue(startForm.startedAt)
  if (new Date(startedAt).getTime() > Date.now() + 60000) {
    showToast('开始时间不能晚于当前时间')
    return
  }
  await db.records.add({
    id: createId('sleep'),
    babyId: selectedBaby.value.id,
    planId: currentPlan.value.id,
    positionId: selectedPositionId.value,
    startedAt,
    source: 'live',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  showStartEditor.value = false
  await refresh()
}

function openFinishEditor() {
  if (!runningRecord.value) return
  finishForm.endedAt = toDateTimeLocalValue()
  showFinishEditor.value = true
}

async function finishSleep() {
  if (!runningRecord.value) return
  const endedAt = fromDateTimeLocalValue(finishForm.endedAt)
  if (new Date(endedAt) <= new Date(runningRecord.value.startedAt)) {
    showToast('结束时间要晚于开始时间')
    return
  }
  if (new Date(endedAt).getTime() > Date.now() + 60000) {
    showToast('结束时间不能晚于当前时间')
    return
  }
  const updated = { ...runningRecord.value, endedAt, updatedAt: nowIso() }
  await db.records.put(updated)
  showFinishEditor.value = false
  await refresh()
}

function openManualEditor() {
  editingRecordId.value = ''
  recordForm.startedAt = toDateTimeLocalValue()
  recordForm.endedAt = toDateTimeLocalValue()
  recordForm.planId = currentPlan.value?.id || ''
  recordForm.positionId = selectedPositionId.value || recordPlan.value?.positions[0]?.id || ''
  recordForm.note = ''
  showRecordEditor.value = true
}

function openRecordEditor(record: SleepRecord) {
  editingRecordId.value = record.id
  recordForm.startedAt = toDateTimeLocalValue(record.startedAt)
  recordForm.endedAt = toDateTimeLocalValue(record.endedAt || nowIso())
  recordForm.planId = record.planId
  recordForm.positionId = record.positionId
  recordForm.note = record.note || ''
  showRecordEditor.value = true
}

async function saveRecord() {
  if (!selectedBaby.value || !recordForm.planId || !recordPlan.value || !recordForm.positionId) {
    showToast('请选择方案和睡姿')
    return
  }
  const startedAt = fromDateTimeLocalValue(recordForm.startedAt)
  const endedAt = fromDateTimeLocalValue(recordForm.endedAt)
  if (new Date(endedAt) <= new Date(startedAt)) {
    showToast('结束时间要晚于开始时间')
    return
  }
  const overlaps = records.value.filter((record) => {
    if (record.id === editingRecordId.value || record.babyId !== selectedBaby.value?.id || !record.endedAt) return false
    const start = Math.max(new Date(startedAt).getTime(), new Date(record.startedAt).getTime())
    const end = Math.min(new Date(endedAt).getTime(), new Date(record.endedAt).getTime())
    return end > start
  })
  if (overlaps.length) {
    await showConfirmDialog({ title: '时间有重叠', message: '这段时间和已有记录重叠，仍然保存吗？' })
  }
  const timestamp = nowIso()
  await db.records.put({
    id: editingRecordId.value || createId('sleep'),
    babyId: selectedBaby.value.id,
    planId: recordForm.planId,
    positionId: recordForm.positionId,
    startedAt,
    endedAt,
    note: recordForm.note,
    source: editingRecordId.value ? (records.value.find((item) => item.id === editingRecordId.value)?.source || 'manual') : 'manual',
    createdAt: records.value.find((item) => item.id === editingRecordId.value)?.createdAt || timestamp,
    updatedAt: timestamp,
  })
  showRecordEditor.value = false
  await refresh()
}

function syncRecordPosition() {
  const positions = recordPlan.value?.positions || []
  if (!positions.some((item) => item.id === recordForm.positionId)) {
    recordForm.positionId = positions[0]?.id || ''
  }
}

async function deleteRecord() {
  if (!editingRecordId.value) return
  await showConfirmDialog({ title: '删除记录', message: '删除后不会计入统计，确定删除吗？' })
  await db.records.delete(editingRecordId.value)
  showRecordEditor.value = false
  await refresh()
}

function openPlanEditor(plan?: PositionPlan) {
  editingPlanId.value = plan?.id || ''
  planForm.name = plan?.name || ''
  planForm.positions = plan?.positions.map((item) => ({ ...item })) || [
    { id: createId('pos'), name: '左侧睡', targetPercent: 50, color: '#7c9a92' },
    { id: createId('pos'), name: '右侧睡', targetPercent: 50, color: '#d98b73' },
  ]
  showPlanEditor.value = true
}

function addPlanPosition() {
  planForm.positions.push({ id: createId('pos'), name: '', targetPercent: 0, color: '#8aa8c8' })
}

function removePlanPosition(index: number) {
  planForm.positions.splice(index, 1)
}

async function savePlan() {
  if (!selectedBaby.value) return
  if (!planForm.name.trim() || !planForm.positions.length) {
    showToast('请填写方案和睡姿')
    return
  }
  if (targetTotal.value !== 100) {
    showToast('目标合计需要等于100%')
    return
  }
  const timestamp = nowIso()
  const planId = editingPlanId.value || createId('plan')
  const positions = planForm.positions.map((item) => ({
    id: item.id,
    name: item.name.trim(),
    targetPercent: Number(item.targetPercent || 0),
    color: item.color,
  }))
  await db.plans.put({
    id: planId,
    babyId: selectedBaby.value.id,
    name: planForm.name.trim(),
    positions,
    status: 'active',
    createdAt: plans.value.find((item) => item.id === planId)?.createdAt || timestamp,
    updatedAt: timestamp,
  })
  if (!selectedBaby.value.currentPlanId) await setCurrentPlan(planId)
  showPlanEditor.value = false
  await refresh()
}

async function setCurrentPlan(planId: string) {
  if (!selectedBaby.value) return
  await db.babies.put({ ...selectedBaby.value, currentPlanId: planId, updatedAt: nowIso() })
  await refresh()
}

function openBabyEditor(baby?: Baby) {
  editingBabyId.value = baby?.id || ''
  babyForm.name = baby?.name || ''
  babyForm.birthday = baby?.birthday || new Date().toISOString().slice(0, 10)
  babyForm.gestationalWeeks = baby?.gestationalWeeks || 40
  babyForm.gestationalDays = baby?.gestationalDays || 0
  showBabyEditor.value = true
}

async function saveBaby() {
  const timestamp = nowIso()
  const existing = babies.value.find((baby) => baby.id === editingBabyId.value)
  const baby: Baby = {
    id: existing?.id || createId('baby'),
    name: babyForm.name || '宝宝',
    birthday: babyForm.birthday,
    gestationalWeeks: Number(babyForm.gestationalWeeks || 40),
    gestationalDays: Number(babyForm.gestationalDays || 0),
    currentPlanId: existing?.currentPlanId,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
  }
  await db.babies.put(baby)
  settings.selectedBabyId = baby.id
  await persistSettings()
  showBabyEditor.value = false
  await refresh()
}

function positionName(positionId: string) {
  return plans.value.flatMap((plan) => plan.positions).find((item) => item.id === positionId)?.name || '未知睡姿'
}

function positionColor(positionId: string) {
  return plans.value.flatMap((plan) => plan.positions).find((item) => item.id === positionId)?.color || '#7c9a92'
}

function timelineStyle(record: SleepRecord) {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  const start = Math.max(new Date(record.startedAt).getTime(), dayStart.getTime())
  const end = Math.min(new Date(record.endedAt || nowIso()).getTime(), dayEnd.getTime())
  const left = ((start - dayStart.getTime()) / 86400000) * 100
  const width = Math.max(4, ((end - start) / 86400000) * 100)
  const color = currentPlan.value?.positions.find((item) => item.id === record.positionId)?.color || '#7c9a92'
  return { left: `${left}%`, width: `${width}%`, background: color }
}

async function downloadBackup() {
  const payload = await exportBackup()
  settings.lastBackupAt = payload.exportedAt
  await persistSettings()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `baby-sleep-backup-${payload.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  showToast('已导出备份')
}

function triggerImport() {
  fileInput.value?.click()
}

async function handleImport(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const payload = JSON.parse(await file.text())
  const result = await importBackup(payload)
  showToast(`导入完成：新增${result.recordsAdded}条，跳过${result.recordsSkipped}条重复`)
  await refresh()
}

async function clearLocalData() {
  await showConfirmDialog({
    title: '清空本机数据',
    message: '会删除当前设备里的宝宝、睡姿方案和睡眠记录。建议确认已经备份后再继续。',
  })
  await db.transaction('rw', db.babies, db.plans, db.records, db.settings, async () => {
    await db.records.clear()
    await db.plans.clear()
    await db.babies.clear()
    await db.settings.clear()
  })
  await refresh()
  activeTab.value = 'home'
  showToast('已清空本机数据')
}

onMounted(async () => {
  await refresh()
  if (selectedBaby.value) {
    babyForm.name = selectedBaby.value.name
    babyForm.birthday = selectedBaby.value.birthday
    babyForm.gestationalWeeks = selectedBaby.value.gestationalWeeks
    babyForm.gestationalDays = selectedBaby.value.gestationalDays
  }
  window.setInterval(() => {
    liveNow.value = Date.now()
  }, 30000)
})
</script>
