import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import DuelView from "../views/DuelView.vue";
import ResultsView from "../views/ResultsView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
    },
    {
      path: "/duel",
      name: "duel",
      component: DuelView,
    },
    {
      path: "/results",
      name: "results",
      component: ResultsView,
    },
  ],
});
