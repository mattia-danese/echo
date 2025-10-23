"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { muteFriend, unfriendFriend, unMuteFriend } from "@/app/actions";

type Friend = {
  id: number;
  firstName: string;
  lastName: string;
  profilePic: string | null;
  isMuted: boolean;
};

export function useFriends(userId: number, initial?: Friend[]) {
  return useQuery({
    queryKey: ["friends", userId],
    queryFn: async () => {
      const res = await fetch(`/api/friends/${userId}`);
      if (!res.ok) throw new Error("Failed to load friends");
      return (await res.json()) as Friend[];
    },
    // Use server-rendered list on first paint; Query takes over after
    initialData: initial,
    staleTime: 60_000,
  });
}

export function useFriendMutations(userId: number) {
  const qc = useQueryClient();

  const toggleMute = useMutation({
    mutationFn: async ({
      friendId,
      nextMuted,
    }: {
      friendId: number;
      nextMuted: boolean;
    }) => {
      return nextMuted
        ? muteFriend(userId, friendId)
        : unMuteFriend(userId, friendId);
    },
    onMutate: async ({ friendId, nextMuted }) => {
      await qc.cancelQueries({ queryKey: ["friends", userId] });
      const previous = qc.getQueryData<Friend[]>(["friends", userId]);
      qc.setQueryData<Friend[]>(["friends", userId], (old) =>
        (old ?? []).map((f) =>
          f.id === friendId ? { ...f, isMuted: nextMuted } : f,
        ),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["friends", userId], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["friends", userId] }), // background refresh
  });

  const unfriend = useMutation({
    mutationFn: async ({ friendId }: { friendId: number }) =>
      unfriendFriend(userId, friendId),
    onMutate: async ({ friendId }) => {
      await qc.cancelQueries({ queryKey: ["friends", userId] });
      const previous = qc.getQueryData<Friend[]>(["friends", userId]);
      qc.setQueryData<Friend[]>(["friends", userId], (old) =>
        (old ?? []).filter((f) => f.id !== friendId),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(["friends", userId], ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["friends", userId] }), // background refresh
  });

  return { toggleMute, unfriend };
}
