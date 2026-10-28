import { Module } from "@medusajs/framework/utils";
import KnowledgeModuleService from "./service";

export const KNOWLEDGE_MODULE = "knowledge";

export default Module(KNOWLEDGE_MODULE, { service: KnowledgeModuleService });
