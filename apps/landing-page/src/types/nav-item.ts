export interface IMenuItem {
  icon?: React.FC;
  name: string;
  href: string;
  description: string;
}

export default interface INavItem {
  name: string;
  eventName?: string;
  alt?: string;
  href?: string;
  icon?: React.FC;
  menuItems?: IMenuItem[];
}
