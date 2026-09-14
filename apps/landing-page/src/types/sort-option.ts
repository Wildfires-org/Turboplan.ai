import { SortDirection } from "./sort-direction";

export default interface ISortOption {
  name: string;
  label: string;
  direction: SortDirection;
}
