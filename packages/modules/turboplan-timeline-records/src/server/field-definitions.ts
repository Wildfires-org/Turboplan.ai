import type { FieldDefinition } from "../types";

export const projectFieldDefs: FieldDefinition[] = [
  { field: "name", valueType: "text" },
  { field: "description", valueType: "text" },
  { field: "status", valueType: "enum" },
  { field: "isPublic", valueType: "boolean" },
  { field: "startDate", valueType: "date" },
  { field: "endDate", valueType: "date" },
  { field: "coverImageId", valueType: "text" },
  { field: "hiddenModules", valueType: "json" },
  { field: "privateModules", valueType: "json" },
  { field: "moduleOrder", valueType: "json" },
];

export const taskFieldDefs: FieldDefinition[] = [
  { field: "title", valueType: "text" },
  { field: "description", valueType: "text" },
  { field: "status", valueType: "enum" },
  { field: "assigneeIds", valueType: "users" },
  { field: "dependencies", valueType: "json" },
  { field: "projectDocumentIds", valueType: "json" },
  { field: "startDate", valueType: "date" },
  { field: "dueDate", valueType: "date" },
  { field: "milestoneId", valueType: "text" },
  { field: "order", valueType: "number" },
];

export const milestoneFieldDefs: FieldDefinition[] = [
  { field: "title", valueType: "text" },
  { field: "assigneeIds", valueType: "users" },
  { field: "startDate", valueType: "date" },
  { field: "dueDate", valueType: "date" },
  { field: "status", valueType: "enum" },
  { field: "order", valueType: "number" },
];

export const projectCustomFieldDefs: FieldDefinition[] = [
  { field: "name", valueType: "text" },
  { field: "type", valueType: "enum" },
  { field: "isRequired", valueType: "boolean" },
  { field: "tooltip", valueType: "text" },
  { field: "values", valueType: "json" },
  { field: "order", valueType: "number" },
];

export const mapLayerFieldDefs: FieldDefinition[] = [
  { field: "name", valueType: "text" },
  { field: "layerName", valueType: "text" },
  { field: "layerType", valueType: "enum" },
];

export const commentFieldDefs: FieldDefinition[] = [
  { field: "content", valueType: "text" },
];

export const documentFieldDefs: FieldDefinition[] = [
  { field: "originalFilename", valueType: "text" },
  { field: "mimeType", valueType: "text" },
  { field: "size", valueType: "number" },
];

export const memberFieldDefs: FieldDefinition[] = [
  { field: "role", valueType: "role" },
];
