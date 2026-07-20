import { StoreKey } from "../app/constant";
import { useSdStore } from "../app/store/sd";
import { getLocalAppState, mergeAppState } from "../app/utils/sync";

describe("Sub2API managed export/import state", () => {
  test("includes image studio history in local app state", () => {
    useSdStore.setState({
      currentId: 3,
      draw: [{ id: "img-local", status: "success", img_data: "/x.png" }],
    } as any);

    const state = getLocalAppState();

    expect(state[StoreKey.SdList].draw).toEqual([
      expect.objectContaining({ id: "img-local" }),
    ]);
  });

  test("merges imported image studio history by id", () => {
    const local = getLocalAppState();
    const remote = JSON.parse(JSON.stringify(local));
    local[StoreKey.SdList].currentId = 1;
    local[StoreKey.SdList].draw = [{ id: "img-local" }] as any;
    remote[StoreKey.SdList].currentId = 9;
    remote[StoreKey.SdList].draw = [
      { id: "img-remote" },
      { id: "img-local" },
    ] as any;

    const merged = mergeAppState(local, remote);

    expect(merged[StoreKey.SdList].currentId).toBe(9);
    expect(merged[StoreKey.SdList].draw.map((item: any) => item.id)).toEqual([
      "img-remote",
      "img-local",
    ]);
  });
});
