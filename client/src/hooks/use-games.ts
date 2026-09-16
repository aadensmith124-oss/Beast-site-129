import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

export function useGames() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const playDice = useMutation({
    mutationFn: async (betAmount: number) => {
      const res = await fetch(api.games.dice.path, {
        method: api.games.dice.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ betAmount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Game failed");
      }
      return api.games.dice.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], (old: any) => ({ ...old, balance: data.newBalance }));
      if (data.won) {
        toast({ title: "You Won!", description: `Payout: $${(data.payout / 100).toFixed(2)}`, className: "bg-red-600 text-white" });
      }
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const playMines = useMutation({
    mutationFn: async (data: { betAmount: number; difficulty: "simple" | "extreme" | "impossible" }) => {
      const res = await fetch(api.games.mines.path, {
        method: api.games.mines.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Game failed");
      }
      return api.games.mines.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], (old: any) => ({ ...old, balance: data.newBalance }));
      if (data.won) {
         toast({ title: "Mines Cleared!", description: `Payout: $${(data.payout / 100).toFixed(2)}`, className: "bg-red-600 text-white" });
      } else {
         toast({ title: "Boom!", description: "You hit a mine.", variant: "destructive" });
      }
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const playPlinko = useMutation({
    mutationFn: async (betAmount: number) => {
      const res = await fetch(api.games.plinko.path, {
        method: api.games.plinko.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ betAmount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Game failed");
      }
      return api.games.plinko.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], (old: any) => ({ ...old, balance: data.newBalance }));
      toast({
        title: data.profit >= 0 ? "Plinko payout" : "Plinko result",
        description: `${data.multiplier}x slot · ${data.profit >= 0 ? "+" : ""}$${(data.profit / 100).toFixed(2)}`,
        variant: data.profit >= 0 ? "default" : "destructive",
      });
    },
    onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const spinWheel = useMutation({
    mutationFn: async () => {
      const res = await fetch(api.games.spin.path, {
        method: api.games.spin.method,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Spin failed");
      }
      return api.games.spin.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.setQueryData([api.auth.me.path], (old: any) => ({ ...old, balance: data.newBalance }));
      toast({ title: "Daily Spin!", description: `You won $${(data.reward / 100).toFixed(2)}` });
    },
    onError: (err) => toast({ title: "Spin unavailable", description: err.message, variant: "destructive" }),
  });

  return { playDice, playMines, playPlinko, spinWheel };
}
