<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <h2>水墨 Shuimo</h2>
      </div>
      <nav class="nav-menu">
        <template v-for="item in menuItems" :key="item.name">
          <div v-if="item.children" class="nav-group">
            <div class="nav-group-title" @click="toggleGroup(item.name)">
              <span>{{ item.name }}</span>
              <span class="arrow" :class="{ expanded: expandedGroups.has(item.name) }">▼</span>
            </div>
            <transition name="collapse">
              <div v-show="expandedGroups.has(item.name)" class="nav-group-items">
                <router-link
                  v-for="child in item.children"
                  :key="child.path"
                  :to="child.path"
                  class="nav-item nav-item-child"
                  active-class="active"
                >
                  {{ child.name }}
                </router-link>
              </div>
            </transition>
          </div>
          <router-link
            v-else
            :to="item.path"
            class="nav-item"
            active-class="active"
          >
            {{ item.name }}
          </router-link>
        </template>
      </nav>
    </aside>
    <main class="content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const expandedGroups = ref(new Set(['Flower', 'Shanshui', 'Stamp']))

const menuItems = [
  {
    name: 'Flower',
    children: [
      { path: '/flower-canvas', name: 'Canvas' },
    ]
  },
  {
    name: 'Shanshui',
    children: [
      { path: '/shanshui', name: 'Main' },
      { path: '/shanshui-elements', name: 'Elements' },
      { path: '/cloud', name: 'Cloud' },
    ]
  },
  {
    name: 'Stamp',
    children: [
      { path: '/stamp', name: 'Basic' },
      { path: '/stamp-playground', name: 'Playground' },
    ]
  },
]

function toggleGroup(groupName: string) {
  if (expandedGroups.value.has(groupName)) {
    expandedGroups.value.delete(groupName)
  } else {
    expandedGroups.value.add(groupName)
  }
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  width: 100%;
}

.sidebar {
  width: 240px;
  background-color: #2c3e50;
  color: #ecf0f1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #34495e;
}

.logo {
  padding: 24px 20px;
  border-bottom: 1px solid #34495e;
}

.logo h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #ecf0f1;
}

.nav-menu {
  flex: 1;
  padding: 16px 0;
  overflow-y: auto;
}

.nav-group {
  margin-bottom: 4px;
}

.nav-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  color: #ecf0f1;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.nav-group-title:hover {
  background-color: #34495e;
}

.arrow {
  font-size: 10px;
  transition: transform 0.2s ease;
  transform: rotate(-90deg);
}

.arrow.expanded {
  transform: rotate(0deg);
}

.nav-group-items {
  overflow: hidden;
}

.nav-item {
  display: block;
  padding: 12px 20px;
  color: #bdc3c7;
  text-decoration: none;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.nav-item-child {
  padding-left: 36px;
  font-size: 14px;
}

.nav-item:hover {
  background-color: #34495e;
  color: #ecf0f1;
}

.nav-item.active {
  background-color: #34495e;
  color: #3498db;
  border-left-color: #3498db;
}

.content {
  flex: 1;
  overflow: auto;
  background-color: #f5f5f5;
}

.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
